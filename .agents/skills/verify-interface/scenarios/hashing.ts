import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

/** Independent scrypt, digest and parsing helpers, so the scenario checks the stored hash without the library. */
const HASH_HELPERS = `
  const b64 = (buffer) => buffer.toString("base64").replace(/=+$/, "");
  const scryptOf = (value, salt, keylen, ln, r, p) => crypto.scryptSync(JSON.stringify(value), salt, keylen, { N: 2 ** ln, r, p, maxmem: 1024 * 1024 * 1024 });
  const scryptString = (value, ln, r, p, saltBytes = 16, keyBytes = 32) => { const salt = Buffer.alloc(saltBytes, 7); return "$scrypt$ln=" + ln + ",r=" + r + ",p=" + p + "$" + b64(salt) + "$" + b64(scryptOf(value, salt, keyBytes, ln, r, p)); };
  const digest = (algorithm, salt, value) => crypto.createHash(algorithm).update(salt).update(JSON.stringify(value)).digest("base64");
  class Account extends d.Table.with(d.HashModifier) {}
  decorate(Account, { name: [d.Field("string")], password: [d.Hashed(), d.Field("string")], pin: [d.Hashed({ algorithm: "sha256" }), d.Field("string")], token: [d.Hashed({ algorithm: "sha256" }), d.Field("string")] });
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
  const afterRewrite = [rewritten._internal.data.password.startsWith("$scrypt$ln=15,r=8,p=3$"), (await accounts.get("legacy")).isHashOutdated("password"), await (await accounts.get("legacy")).testHashAsync("password", "hunter2")];
  const lowBefore = (await rawRow("lowcost"))._internal.data.password;
  await accounts.update("lowcost", { name: "renamed" });
  const keptByNameUpdate = (await rawRow("lowcost"))._internal.data.password === lowBefore;
  await accounts.update({ _id: "lowcost", name: "renamed again" });
  const keptByObjectUpdate = (await rawRow("lowcost"))._internal.data.password === lowBefore;
  await accounts.update("lowcost", { password: "hunter2" });
  const viaUpdate = (await rawRow("lowcost"))._internal.data.password.startsWith("$scrypt$ln=15,r=8,p=3$");
  return { before, wrongLegacy, afterRewrite, keptByNameUpdate, keptByObjectUpdate, viaUpdate };
`;

const DIGEST = `${HASH_HELPERS}
  const [id] = await accounts.insert({ name: "Ann", pin: "1234", token: "abc" });
  const raw = await rawRow(id);
  const salt = raw._internal.meta.HashModifier.salt;
  const row = await accounts.get(id);
  const [other] = await accounts.insert({ name: "Bea", pin: "1234" });
  const otherSalt = (await rawRow(other))._internal.meta.HashModifier.salt;
  const again = await accounts.get(id);
  again.pin = "9999";
  const rewritten = d.toDatabase(again);
  const holdsScrypt = Model.fromDatabase({ _id: "h", name: "h", _internal: { meta: { HashModifier: { salt } }, data: { pin: scryptString("1234", 10, 8, 1) } } });
  const sha512 = Model.fromDatabase({ _id: "s", name: "s", _internal: { meta: { HashModifier: { salt } }, data: { pin: crypto.createHash("sha512").update(salt).update(JSON.stringify("1234")).digest("base64") } } });
  return {
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
  "hash-digest": scenario({ title: "a field with an algorithm stores a salted digest with the row's shared salt", body: DIGEST, printed: "{\"storedDigest\":true,\"sharedSalt\":true,\"saltIsText\":true,\"freshSaltPerRow\":true,\"saltReusedOnLaterWrite\":[true,true],\"testDigest\":[true,false,true],\"digestNeverOutdated\":false,\"scryptOnDigestField\":[true,false],\"otherDigestRefused\":false}" }),
} satisfies { [id: string]: Journey };
