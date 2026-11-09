/** Independent scrypt, digest and parsing helpers, so the scenario checks the stored hash without the library. */
export const HASH_HELPERS = `
  const CURRENT = "$" + "scrypt" + "$ln=15,r=8,p=3$";
  const b64 = (buffer) => buffer.toString("base64").replace(/=+$/, "");
  const scryptOf = (value, salt, keylen, ln, r, p) => crypto.scryptSync(JSON.stringify(value), salt, keylen, { N: 2 ** ln, r, p, maxmem: 1024 * 1024 * 1024 });
  const scryptString = (value, ln, r, p, saltBytes = 16, keyBytes = 32) => { const salt = Buffer.alloc(saltBytes, 7); return "$" + "scrypt" + "$ln=" + ln + ",r=" + r + ",p=" + p + "$" + b64(salt) + "$" + b64(scryptOf(value, salt, keyBytes, ln, r, p)); };
  const digest = (algorithm, salt, value) => crypto.createHash(algorithm).update(salt).update(JSON.stringify(value)).digest("base64");
  class Account extends d.Table.with(d.HashModifier) {}
  decorate(Account, { name: [d.Field("string")], password: [d.Hashed(), d.Field("string")], pin: [d.Hashed({ algorithm: "sha256" }), d.Field("string")], token: [d.Hashed({ algorithm: "sha256" }), d.Field("string")], long: [d.Hashed({ algorithm: "sha512" }), d.Field("string")], legacy: [d.Hashed({ algorithm: "md5" }), d.Field("string")], one: [d.Hashed({ algorithm: "sha1" }), d.Field("string")], mid: [d.Hashed({ algorithm: "sha384" }), d.Field("string")] });
  d.RegisterTable("accounts", "hash")(Account);
  await d.RegisterSchema("hash");
  const Model = d.BasicDataModel(Account);
  const accounts = d.GetModel(Model);
  const rawRow = async (id) => rawTable("hash", "accounts").get(id);
`;

export const STORAGE = `${HASH_HELPERS}
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

export const VERIFY = `${HASH_HELPERS}
  const [id] = await accounts.insert({ name: "Ann", password: "secret" });
  const row = await accounts.get(id);
  const asyncRight = await row.testHashAsync("password", "secret");
  const asyncWrong = await row.testHashAsync("password", "Secret");
  const syncRight = row.testHash("password", "secret");
  const syncWrong = row.testHash("password", "nope");
  const notHashedAsync = await rejection(row.testHashAsync("name", "Ann"));
  let notHashedSync = null;
  try { row.testHash("name", "Ann"); } catch (error) { notHashedSync = error.message; }
  let notHashedOutdated = null;
  try { row.isHashOutdated("name"); } catch (error) { notHashedOutdated = error.message; }
  const [bare] = await accounts.insert({ name: "Nobody" });
  const bareRow = await accounts.get(bare);
  return {
    asyncRight, asyncWrong, syncRight: [typeof syncRight, syncRight], syncWrong,
    fresh: row.isHashOutdated("password"),
    notHashedAsync: notHashedAsync && notHashedAsync.message,
    notHashedSync,
    notHashedOutdated,
    nothingStored: [bareRow.isHashOutdated("password"), await bareRow.testHashAsync("password", "x")],
  };
`;

export const UPGRADE = `${HASH_HELPERS}
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

export const DIGEST = `${HASH_HELPERS}
  const [id] = await accounts.insert({ name: "Ann", pin: "1234", token: "abc", long: "abc", legacy: "abc", one: "abc", mid: "abc" });
  const raw = await rawRow(id);
  const salt = raw._internal.meta.HashModifier.salt;
  const others = [raw._internal.data.one === digest("sha1", salt, "abc"), raw._internal.data.mid === digest("sha384", salt, "abc")];
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
    algorithms, others, algorithmTests, wrongDigest,
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

export const OUTDATED = `${HASH_HELPERS}
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
