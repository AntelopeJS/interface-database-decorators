import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

/** Independent scrypt, digest and parsing helpers, so the scenario checks the stored hash without the library. */
const HASH_HELPERS = `
  const CURRENT = "$" + "scrypt" + "$ln=15,r=8,p=3$";
  const b64 = (buffer) => buffer.toString("base64").replace(/=+$/, "");
  const scryptOf = (value, salt, keylen, ln, r, p) => crypto.scryptSync(JSON.stringify(value), salt, keylen, { N: 2 ** ln, r, p, maxmem: 1024 * 1024 * 1024 });
  const scryptString = (value, ln, r, p, saltBytes = 16, keyBytes = 32) => { const salt = Buffer.alloc(saltBytes, 7); return "$" + "scrypt" + "$ln=" + ln + ",r=" + r + ",p=" + p + "$" + b64(salt) + "$" + b64(scryptOf(value, salt, keyBytes, ln, r, p)); };
  const digest = (algorithm, salt, value) => crypto.createHash(algorithm).update(salt).update(JSON.stringify(value)).digest("base64");
  class Account extends d.Table.with(d.HashModifier) {}
  decorate(Account, { name: [d.Field("string")], password: [d.Hashed(), d.Field("string")], pin: [d.Hashed({ algorithm: "sha256" }), d.Field("string")], token: [d.Hashed({ algorithm: "sha256" }), d.Field("string")], long: [d.Hashed({ algorithm: "sha512" }), d.Field("string")], legacy: [d.Hashed({ algorithm: "md5" }), d.Field("string")] });
  d.RegisterTable("accounts", "hash")(Account);
  await d.RegisterSchema("hash");
  const Model = d.BasicDataModel(Account);
  const accounts = d.GetModel(Model);
  const rawRow = async (id) => rawTable("hash", "accounts").get(id);
`;

const STORAGE = `${HASH_HELPERS}
  const [id] = await accounts.insert({ name: "Ann", password: "secret" });
  const [second] = await accounts.insert({ name: "Bea", password: "secret" });
  const raw = await rawRow(id);
  const stored = raw._internal.data.password;
  const match = /^\\$scrypt\\$ln=15,r=8,p=3\\$([A-Za-z0-9+/]+)\\$([A-Za-z0-9+/]+)$/.exec(stored);
  const salt = Buffer.from(match[1], "base64");
  const key = Buffer.from(match[2], "base64");
  const expected = scryptOf("secret", salt, 32, 15, 8, 3);
  const loaded = await accounts.get(id);
  d.lock(loaded, d.HashModifier, ["password"]);
  const kept = d.toDatabase(loaded)._internal.data.password;
  loaded.password = stored;
  const undef = Model.fromPlainData({ _id: "y", password: undefined });
  return {
    format: [Boolean(match), salt.length, key.length, match[1].includes("="), match[2].includes("=")],
    hashesTheJsonText: Buffer.compare(key, expected) === 0,
    plaintextAbsent: !JSON.stringify(raw).includes("secret"),
    freshSaltEachWrite: raw._internal.data.password !== (await rawRow(second))._internal.data.password,
    lockKeepsTheHash: kept === stored,
    assigningTheStoredHashKeepsIt: d.toDatabase(loaded)._internal.data.password === stored,
    undefinedStoresNothing: d.toDatabase(undef)._internal === undefined || d.toDatabase(undef)._internal.data.password === undefined,
  };
`;

const VERIFY = `${HASH_HELPERS}
  const [id] = await accounts.insert({ name: "Ann", password: "secret" });
  const row = await accounts.get(id);
  const asyncRight = await row.testHashAsync("password", "secret");
  const asyncWrong = await row.testHashAsync("password", "Secret");
  const syncRight = row.testHash("password", "secret");
  const syncWrong = row.testHash("password", "nope");
  const notHashedAsync = await rejection(row.testHashAsync("name", "Ann"));
  let notHashedOutdated = null;
  try { row.isHashOutdated("name"); } catch (error) { notHashedOutdated = error.message; }
  const [bare] = await accounts.insert({ name: "Nobody" });
  const bareRow = await accounts.get(bare);
  return {
    asyncRight, asyncWrong, syncRight: [typeof syncRight, syncRight], syncWrong,
    fresh: row.isHashOutdated("password"),
    notHashedAsync: notHashedAsync && notHashedAsync.message,
    notHashedOutdated,
    nothingStored: [bareRow.isHashOutdated("password"), await bareRow.testHashAsync("password", "x")],
  };
`;

const LIMITS = `${HASH_HELPERS}
  const seed = async (id, password, extra = {}) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta: {}, data: { password } }, ...extra }).run();
  const cases = {
    cheap: [10, 8, 1], boundaryMemory: [17, 8, 1], tooMuchMemory: [18, 8, 1],
    parallelBoundary: [8, 8, 16], parallelTooMany: [8, 8, 17], costBelow16TimesR: [15, 1, 1],
  };
  const verdicts = {};
  for (const [name, [ln, r, p]] of Object.entries(cases)) {
    await seed(name, scryptString("pw", ln, r, p));
    const row = await accounts.get(name);
    verdicts[name] = [await row.testHashAsync("password", "pw"), await row.testHashAsync("password", "other")];
  }
  const sizes = { shortSalt: scryptString("pw", 8, 8, 1, 8, 32), longKey: scryptString("pw", 8, 8, 1, 16, 64), tooLongKey: scryptString("pw", 8, 8, 1, 16, 80), shortKey: scryptString("pw", 8, 8, 1, 16, 8), threeDigitP: scryptString("pw", 4, 1, 100) };
  for (const [name, stored] of Object.entries(sizes)) {
    await seed(name, stored);
    verdicts[name] = await (await accounts.get(name)).testHashAsync("password", "pw");
  }
  return verdicts;
`;

const UPGRADE = `${HASH_HELPERS}
  const seed = async (id, data, meta = {}) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta, data } }).run();
  await seed("legacy", { password: digest("sha256", "old-salt", "hunter2") }, { HashModifier: { salt: "old-salt" } });
  await seed("lowcost", { password: scryptString("hunter2", 10, 8, 1) });
  const legacy = await accounts.get("legacy");
  const lowcost = await accounts.get("lowcost");
  const before = [await legacy.testHashAsync("password", "hunter2"), legacy.isHashOutdated("password"), await lowcost.testHashAsync("password", "hunter2"), lowcost.isHashOutdated("password")];
  const wrongLegacy = await legacy.testHashAsync("password", "wrong");
  if (await legacy.testHashAsync("password", "hunter2")) { if (legacy.isHashOutdated("password")) { legacy.password = "hunter2"; await accounts.update(legacy); } }
  const rewritten = await rawRow("legacy");
  const afterRewrite = [rewritten._internal.data.password.startsWith(CURRENT), (await accounts.get("legacy")).isHashOutdated("password"), await (await accounts.get("legacy")).testHashAsync("password", "hunter2")];
  const lowBefore = (await rawRow("lowcost"))._internal.data.password;
  await accounts.update("lowcost", { name: "renamed" });
  const keptByNameUpdate = (await rawRow("lowcost"))._internal.data.password === lowBefore;
  await accounts.update({ _id: "lowcost", name: "renamed again" });
  const keptByObjectUpdate = (await rawRow("lowcost"))._internal.data.password === lowBefore;
  await accounts.update("lowcost", { password: "hunter2" });
  const viaUpdate = (await rawRow("lowcost"))._internal.data.password.startsWith(CURRENT);
  return { before, wrongLegacy, afterRewrite, keptByNameUpdate, keptByObjectUpdate, viaUpdate };
`;

const DIGEST = `${HASH_HELPERS}
  const [id] = await accounts.insert({ name: "Ann", pin: "1234", token: "abc", long: "abc", legacy: "abc" });
  const raw = await rawRow(id);
  const salt = raw._internal.meta.HashModifier.salt;
  const algorithms = [raw._internal.data.long === digest("sha512", salt, "abc"), raw._internal.data.legacy === digest("md5", salt, "abc"), raw._internal.data.long === digest("sha256", salt, "abc"), raw._internal.data.long.length, raw._internal.data.legacy.length];
  const checked = await accounts.get(id);
  const algorithmTests = [checked.testHash("long", "abc"), checked.testHash("legacy", "abc"), checked.testHash("long", "abd")];
  await rawTable("hash", "accounts").insert({ _id: "wrong-digest", name: "w", _internal: { meta: { HashModifier: { salt } }, data: { long: digest("sha256", salt, "abc") } } }).run();
  const wrongDigest = (await accounts.get("wrong-digest")).testHash("long", "abc");
  const row = await accounts.get(id);
  const [other] = await accounts.insert({ name: "Bea", pin: "1234" });
  const otherSalt = (await rawRow(other))._internal.meta.HashModifier.salt;
  const again = await accounts.get(id);
  again.pin = "9999";
  const rewritten = d.toDatabase(again);
  const holdsScrypt = Model.fromDatabase({ _id: "h", name: "h", _internal: { meta: { HashModifier: { salt } }, data: { pin: scryptString("1234", 10, 8, 1) } } });
  const sha512 = Model.fromDatabase({ _id: "s", name: "s", _internal: { meta: { HashModifier: { salt } }, data: { pin: crypto.createHash("sha512").update(salt).update(JSON.stringify("1234")).digest("base64") } } });
  return {
    algorithms, algorithmTests, wrongDigest,
    storedDigest: raw._internal.data.pin === digest("sha256", salt, "1234"),
    sharedSalt: raw._internal.data.token === digest("sha256", salt, "abc"),
    saltIsText: typeof salt === "string" && salt.length > 0,
    freshSaltPerRow: salt !== otherSalt,
    saltReusedOnLaterWrite: [rewritten._internal.meta.HashModifier.salt === salt, rewritten._internal.data.pin === digest("sha256", salt, "9999")],
    testDigest: [row.testHash("pin", "1234"), row.testHash("pin", "0000"), await row.testHashAsync("pin", "1234")],
    digestNeverOutdated: row.isHashOutdated("pin"),
    scryptOnDigestField: [holdsScrypt.testHash("pin", "1234"), holdsScrypt.isHashOutdated("pin")],
    otherDigestRefused: sha512.testHash("pin", "1234"),
  };
`;


const BOUNDS = `${HASH_HELPERS}
  const seed = async (id, password) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta: {}, data: { password } } }).run();
  const attempt = async (id, stored) => {
    await seed(id, stored);
    const row = await accounts.get(id);
    try { return [await row.testHashAsync("password", "pw"), await row.testHashAsync("password", "other")]; } catch (error) { return "threw " + error.name; }
  };
  const fake = (ln, r, p) => "$" + "scrypt" + "$ln=" + ln + ",r=" + r + ",p=" + p + "$" + b64(Buffer.alloc(16, 1)) + "$" + b64(Buffer.alloc(32, 2));
  return {
    r1: await attempt("r1", scryptString("pw", 4, 1, 1)),
    r10: await attempt("r10", scryptString("pw", 4, 10, 1)),
    r99: await attempt("r99", scryptString("pw", 4, 99, 1)),
    r100: await attempt("r100", scryptString("pw", 4, 100, 1)),
    r0: await attempt("r0", fake(4, 0, 1)),
    ln0: await attempt("ln0", fake(0, 8, 1)),
    p0: await attempt("p0", fake(4, 8, 0)),
    p99: await attempt("p99", scryptString("pw", 4, 8, 99)),
    ln16r1: await attempt("ln16r1", fake(16, 1, 1)),
    salt65: await attempt("salt65", scryptString("pw", 4, 8, 1, 65, 32)),
    ln1: await attempt("ln1", scryptString("pw", 1, 8, 1)),
    ln2: await attempt("ln2", scryptString("pw", 2, 8, 1)),
    ln99: await attempt("ln99", fake(99, 8, 1)),
    ln100: await attempt("ln100", fake(100, 8, 1)),
    p1: await attempt("p1", scryptString("pw", 4, 8, 1)),
    p16: await attempt("p16", scryptString("pw", 4, 8, 16)),
    salt16: await attempt("salt16", scryptString("pw", 4, 8, 1, 16, 32)),
    salt64: await attempt("salt64", scryptString("pw", 4, 8, 1, 64, 32)),
    salt80: await attempt("salt80", scryptString("pw", 4, 8, 1, 80, 32)),
    salt15: await attempt("salt15", scryptString("pw", 4, 8, 1, 15, 32)),
    key16: await attempt("key16", scryptString("pw", 4, 8, 1, 16, 16)),
    key64: await attempt("key64", scryptString("pw", 4, 8, 1, 16, 64)),
    key15: await attempt("key15", scryptString("pw", 4, 8, 1, 16, 15)),
    key65: await attempt("key65", scryptString("pw", 4, 8, 1, 16, 65)),
  };
`;

const MEMORY = `${HASH_HELPERS}
  const seed = async (id, password) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta: {}, data: { password } } }).run();
  const attempt = async (id, stored) => {
    await seed(id, stored);
    const row = await accounts.get(id);
    try { return [await row.testHashAsync("password", "pw"), await row.testHashAsync("password", "other")]; } catch (error) { return "threw " + error.name; }
  };
  return {
    exactR64: await attempt("a", scryptString("pw", 14, 64, 1)),
    overR65: await attempt("b", scryptString("pw", 14, 65, 1)),
    exactR2: await attempt("c", scryptString("pw", 19, 2, 1)),
    underR3: await attempt("d", scryptString("pw", 18, 3, 1)),
    overR5: await attempt("e", scryptString("pw", 18, 5, 1)),
    overR9: await attempt("f", scryptString("pw", 17, 9, 1)),
  };
`;

const SYNC_ASYNC = `${HASH_HELPERS}
  const seedRow = async (id, data, meta = {}) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta, data } }).run();
  await seedRow("legacy", { password: digest("sha256", "old-salt", "hunter2") }, { HashModifier: { salt: "old-salt" } });
  await seedRow("lowcost", { password: scryptString("hunter2", 10, 8, 1) });
  await seedRow("junk", { password: "plain text" });
  await seedRow("empty", {});
  await seedRow("digest", { pin: digest("sha256", "pin-salt", "hunter2") }, { HashModifier: { salt: "pin-salt" } });
  await seedRow("scryptOnDigest", { pin: scryptString("hunter2", 10, 8, 1) });
  const [fresh] = await accounts.insert({ name: "fresh", password: "hunter2", pin: "hunter2" });
  const matrix = {};
  for (const [id, field] of [[fresh, "password"], [fresh, "pin"], ["legacy", "password"], ["lowcost", "password"], ["junk", "password"], ["empty", "password"], ["digest", "pin"], ["scryptOnDigest", "pin"]]) {
    const row = await accounts.get(id);
    const answers = [];
    for (const candidate of ["hunter2", "wrong", ""]) {
      const sync = row.testHash(field, candidate);
      const asynchronous = await row.testHashAsync(field, candidate);
      answers.push([sync, asynchronous, sync === asynchronous]);
    }
    matrix[(id === fresh ? "fresh" : id) + ":" + field] = answers;
  }
  return matrix;
`;

const OUTDATED = `${HASH_HELPERS}
  const seed = async (id, password) => rawTable("hash", "accounts").insert({ _id: id, name: id, _internal: { meta: {}, data: { password } } }).run();
  const probe = async (id, stored) => { await seed(id, stored); const row = await accounts.get(id); return [await row.testHashAsync("password", "pw"), row.isHashOutdated("password")]; };
  const [fresh] = await accounts.insert({ name: "fresh", password: "pw" });
  const freshRow = await accounts.get(fresh);
  return {
    fresh: [await freshRow.testHashAsync("password", "pw"), freshRow.isHashOutdated("password")],
    sameCost: await probe("same", scryptString("pw", 15, 8, 3)),
    lowerP: await probe("p1", scryptString("pw", 15, 8, 1)),
    higherR: await probe("r9", scryptString("pw", 15, 9, 3)),
    lowerLn: await probe("ln14", scryptString("pw", 14, 8, 3)),
    notScrypt: await probe("junk", "plain text"),
  };
`;

export const HASH_JOURNEYS = {
  "hash-storage": scenario({
    title: "a hashed field stores a salted scrypt hash of the JSON-encoded value",
    body: STORAGE,
    printed: "{\"format\":[true,16,32,false,false],\"hashesTheJsonText\":true,\"plaintextAbsent\":true,\"freshSaltEachWrite\":true,\"lockKeepsTheHash\":true,\"assigningTheStoredHashKeepsIt\":true,\"undefinedStoresNothing\":true}",
    stored: [{ name: "the stored hash", expression: "$DB.getCollection('hash__accounts').find({ name: 'Ann' }).toArray().map((r) => [Object.keys(r._internal.data), /^\\$scrypt\\$ln=15,r=8,p=3\\$[A-Za-z0-9+/]{22}\\$[A-Za-z0-9+/]{43}$/.test(r._internal.data.password)])", expected: "[[[\"password\"],true]]" }],
  }),
  "hash-verify": scenario({ title: "testHash, testHashAsync and isHashOutdated answer for a hashed field and refuse another", body: VERIFY, printed: "{\"asyncRight\":true,\"asyncWrong\":false,\"syncRight\":[\"boolean\",true],\"syncWrong\":false,\"fresh\":false,\"notHashedAsync\":\"Field name is not hashed\",\"notHashedOutdated\":\"Field name is not hashed\",\"nothingStored\":[false,false]}" }),
  "hash-limits": scenario({ title: "a stored scrypt string verifies only inside the documented limits", body: LIMITS, printed: "{\"cheap\":[true,false],\"boundaryMemory\":[true,false],\"tooMuchMemory\":[false,false],\"parallelBoundary\":[true,false],\"parallelTooMany\":[false,false],\"costBelow16TimesR\":[true,false],\"shortSalt\":false,\"longKey\":true,\"tooLongKey\":false,\"shortKey\":false,\"threeDigitP\":false}" }),
  "hash-upgrade": scenario({
    title: "older hash formats still verify, are flagged, and are rewritten by assigning the tested value",
    body: UPGRADE,
    printed: "{\"before\":[true,true,true,true],\"wrongLegacy\":false,\"afterRewrite\":[true,false,true],\"keptByNameUpdate\":true,\"keptByObjectUpdate\":true,\"viaUpdate\":true}",
  }),
  "hash-bounds": scenario({ title: "a stored scrypt string verifies at each edge of the documented ranges and is refused just outside", body: BOUNDS, printed: "{\"r1\":[true,false],\"r10\":[true,false],\"r99\":[true,false],\"r100\":[false,false],\"r0\":[false,false],\"ln0\":[false,false],\"p0\":[false,false],\"p99\":[false,false],\"ln16r1\":[false,false],\"salt65\":[false,false],\"ln1\":[true,false],\"ln2\":[true,false],\"ln99\":[false,false],\"ln100\":[false,false],\"p1\":[true,false],\"p16\":[true,false],\"salt16\":[true,false],\"salt64\":[true,false],\"salt80\":[false,false],\"salt15\":[false,false],\"key16\":[true,false],\"key64\":[true,false],\"key15\":[false,false],\"key65\":[false,false]}" }),
  "hash-memory": scenario({ title: "a stored scrypt string verifies up to 128 MiB of memory (128 x N x r) and is refused above it", body: MEMORY, printed: "{\"exactR64\":[true,false],\"overR65\":[false,false],\"exactR2\":[true,false],\"underR3\":[true,false],\"overR5\":[false,false],\"overR9\":[false,false]}" }),
  "hash-sync-async": scenario({ title: "testHash answers exactly what testHashAsync answers, for every kind of stored value", body: SYNC_ASYNC, printed: "{\"fresh:password\":[[true,true,true],[false,false,true],[false,false,true]],\"fresh:pin\":[[true,true,true],[false,false,true],[false,false,true]],\"legacy:password\":[[true,true,true],[false,false,true],[false,false,true]],\"lowcost:password\":[[true,true,true],[false,false,true],[false,false,true]],\"junk:password\":[[false,false,true],[false,false,true],[false,false,true]],\"empty:password\":[[false,false,true],[false,false,true],[false,false,true]],\"digest:pin\":[[true,true,true],[false,false,true],[false,false,true]],\"scryptOnDigest:pin\":[[true,true,true],[false,false,true],[false,false,true]]}" }),
  "hash-outdated": scenario({ title: "isHashOutdated flags any scrypt string whose ln, r or p differs from the current cost", body: OUTDATED, printed: "{\"fresh\":[true,false],\"sameCost\":[true,false],\"lowerP\":[true,true],\"higherR\":[true,true],\"lowerLn\":[true,true],\"notScrypt\":[false,true]}" }),
  "hash-digest": scenario({ title: "a field with an algorithm stores a salted digest with the row's shared salt", body: DIGEST, printed: "{\"algorithms\":[true,true,false,88,24],\"algorithmTests\":[true,true,false],\"wrongDigest\":false,\"storedDigest\":true,\"sharedSalt\":true,\"saltIsText\":true,\"freshSaltPerRow\":true,\"saltReusedOnLaterWrite\":[true,true],\"testDigest\":[true,false,true],\"digestNeverOutdated\":false,\"scryptOnDigestField\":[true,false],\"otherDigestRefused\":false}" }),
} satisfies { [id: string]: Journey };
