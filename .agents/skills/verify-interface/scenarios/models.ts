import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

const CRUD = `
  class User extends d.Table {}
  decorate(User, { email: [d.Field("string"), d.Index()], name: [d.Field("string")], role: [d.Field("string"), d.Index()] });
  d.RegisterTable("users", "crud")(User);
  await d.RegisterSchema("crud");
  const users = d.GetModel(d.BasicDataModel(User));
  const single = await users.insert({ email: "alice@example.com", name: "Alice", role: "admin" });
  const batch = await users.insert([{ email: "bob@example.com", name: "Bob", role: "user" }, { email: "carol@example.com", name: "Carol", role: "user" }]);
  const got = await users.get(single[0]);
  const missing = await users.get("no-such-id");
  const admins = (await users.getBy("role", "admin")).map((row) => row.name);
  const byEmail = (await users.getBy("email", "bob@example.com")).map((row) => row.name);
  const everyone = (await users.getAll()).map((row) => row.name).sort();
  const instances = [got instanceof User, (await users.getBy("role", "admin")).every((row) => row instanceof User), (await users.getBy("email", "bob@example.com")).every((row) => row instanceof User), (await users.getAll()).every((row) => row instanceof User), (await users.getAll()).length];
  const updatedById = await users.update(single[0], { name: "Alice Liddell" });
  const updatedByObject = await users.update({ _id: batch[0], name: "Robert" });
  const updatedMissing = await users.update("no-such-id", { name: "Nobody" });
  const noKey = await rejection(users.update({ name: "No key" }));
  const deleted = await users.delete(batch[1]);
  const deletedMissing = await users.delete("no-such-id");
  return {
    insertedIds: [single.length, batch.length, [...single, ...batch].every((id) => typeof id === "string")],
    got: [got instanceof User, got._id === single[0], got.name],
    missing: missing ?? "undefined",
    instances,
    admins, byEmail, everyone,
    updatedById, updatedByObject, updatedMissing, noKey,
    deleted, deletedMissing,
    left: (await users.getAll()).map((row) => row.name).sort(),
  };
`;

const KEY = "12345678901234567890123456789012";

const CONVERSION = `
  class Account extends d.Table.with(d.EncryptionModifier) {}
  decorate(Account, { name: [d.Field("string"), d.Index()], secret: [d.Encrypted({ secretKey: "${KEY}" }), d.Field("string")] });
  d.RegisterTable("accounts", "cnv")(Account);
  await d.RegisterSchema("cnv");
  const Model = d.BasicDataModel(Account);
  const fromPlain = Model.fromPlainData({ _id: "a1", name: "Ann", secret: "s3cret" });
  const sameInstance = Model.fromPlainData(fromPlain) === fromPlain;
  const stored = Model.toDatabase(fromPlain);
  const fromPlainDirect = Model.toDatabase({ _id: "a2", name: "Bea" });
  const record = { _id: "a3", name: "Cy" };
  const copy = Model.fromDatabase(record);
  const empty = Model.fromDatabase({});
  const afterConversions = await rawTable("cnv", "accounts").count();
  const model = d.GetModel(Model);
  const [id] = await model.insert({ name: "Dee", secret: "hidden" });
  const read = await model.get(id);
  const direct = await model.table.get(id);
  const viaGetAll = await model.getAll();
  const viaGetBy = await model.getBy("name", "Dee");
  return {
    fromPlain: [fromPlain instanceof Account, fromPlain.secret, fromPlain.name],
    sameInstance,
    storedShape: [stored instanceof Account, Object.keys(stored).sort(), stored._internal.data.secret.length, stored.secret === undefined],
    plainDataShape: [fromPlainDirect instanceof Account, Object.keys(fromPlainDirect).sort()],
    nullIsUndefined: [Model.fromDatabase(null) === undefined, Model.fromDatabase(undefined) === undefined],
    emptyObjectIsAnInstance: empty instanceof Account,
    copyNotSame: [copy !== record, copy instanceof Account, record instanceof Account, copy.name],
    afterConversions,
    read: [read instanceof Account, read.secret],
    direct: [direct instanceof Account, direct.name, direct._internal !== undefined],
    getAllConverted: viaGetAll.every((row) => row instanceof Account),
    getByConverted: [viaGetBy.length, viaGetBy[0] instanceof Account, viaGetBy[0].secret, viaGetAll[0].secret, read.secret],
  };
`;

const STR = `{ _tag: "codec", name: "string", is: (u) => typeof u === "string", encode: (a) => a, decode: (u) => (typeof u === "string" ? { _tag: "Right", right: u } : { _tag: "Left", left: [{ message: "expected a string" }, { message: "second message" }] }) }`;
const NUM = `{ _tag: "codec", name: "number", is: (u) => typeof u === "number", encode: (a) => a, decode: (u) => (typeof u === "number" ? { _tag: "Right", right: u } : { _tag: "Left", left: [] }) }`;

const VALIDATION = `
  class Person extends d.Table {}
  decorate(Person, { name: [d.Field(${STR})], age: [d.Field(${NUM})], nick: [d.Field("string")], extra: [] });
  d.RegisterTable("people", "val")(Person);
  await d.RegisterSchema("val");
  const Model = d.BasicDataModel(Person);
  const people = d.GetModel(Model);
  const errorOf = async (promise) => { try { await promise; return null; } catch (error) { return { message: error.message, errors: error.errors }; } };
  const valid = Model.validate({ name: "Alice", age: 30 });
  const invalid = Model.validate({ name: 42, age: "old" });
  const notAnObject = Model.validate(null);
  const partialOk = Model.validate({ name: "x" }, { partial: true });
  const partialEmpty = Model.validate({}, { partial: true });
  const partialBad = Model.validate({ age: "old" }, { partial: true });
  const tokenSkipped = Model.validate({ name: "x", age: 1, nick: 99, extra: {} });
  const optIn = await people.insert({ name: 42, age: "anything" });
  const refused = await errorOf(people.insert({ name: 42, age: "old" }, { validate: true }));
  const batchRefused = await errorOf(people.insert([{ name: "ok", age: 1 }, { name: 1, age: 2 }, { name: "fine", age: "x" }], { validate: true }));
  const accepted = await people.insert({ name: "Alice", age: 30 }, { validate: true });
  const patched = await people.update(accepted[0], { name: "Bob" }, { validate: true });
  const patchRefused = await errorOf(people.update(accepted[0], { age: "old" }, { validate: true }));
  const objectPatchRefused = await errorOf(people.update({ _id: accepted[0], name: 7 }, { validate: true }));
  const unvalidatedPatch = await people.update(accepted[0], { age: "old" });
  const presentUndefined = Model.validate({ age: undefined }, { partial: true });
  const absentAge = Model.validate({ name: "x" }, { partial: true });
  const missingRequired = await errorOf(people.insert({ name: "Alice" }, { validate: true }));
  const missingInArray = await errorOf(people.insert([{ name: "Ok", age: 1 }, { name: "No age" }], { validate: true }));
  const missingStored = (await people.getAll()).map((row) => row.name).sort();
  const trim = { _tag: "codec", name: "trim", is: (u) => typeof u === "string", encode: (a) => a, decode: (u) => (typeof u === "string" ? { _tag: "Right", right: u.trim() } : { _tag: "Left", left: [{ message: "not text" }] }) };
  class Label extends d.Table {}
  decorate(Label, { label: [d.Field(trim)] });
  d.RegisterTable("labels", "val")(Label);
  await d.RegisterSchema("val");
  const labels = d.GetModel(d.BasicDataModel(Label));
  const [padded] = await labels.insert({ label: "  padded  " }, { validate: true });
  const [batchA, batchB] = await labels.insert([{ label: " a " }, { label: " b " }], { validate: true });
  const afterInsert = (await rawTable("val", "labels").get(padded)).label;
  await labels.update(padded, { label: "  again  " }, { validate: true });
  const [unvalidated] = await labels.insert({ label: 42 }, { validate: false });
  await labels.update(unvalidated, { label: 43 }, { validate: false });
  const storedLabels = await Promise.all([padded, batchA, batchB, unvalidated].map(async (labelId) => (await rawTable("val", "labels").get(labelId)).label));
  const hole = { _tag: "codec", name: "hole", is: () => false, encode: (a) => a, decode: () => ({ _tag: "Left", left: [{}, { message: "after a hole" }, { message: "last" }] }) };
  const silent = { _tag: "codec", name: "silent", is: () => false, encode: (a) => a, decode: () => ({ _tag: "Left", left: [{}, { message: "" }] }) };
  class Odd extends d.Table {}
  decorate(Odd, { a: [d.Field(hole)], b: [d.Field(silent)] });
  const oddMessages = d.BasicDataModel(Odd, "odd").validate({});
  return { valid, invalid, notAnObject, partialOk, partialEmpty, partialBad, tokenSkipped, optIn: optIn.length, refused, batchRefused, patched, patchRefused, objectPatchRefused, unvalidatedPatch, oddMessages, missingRequired, missingInArray, missingStored, afterInsert, storedLabels, presentUndefined, absentAge };
`;

const GET_MODEL = `
  class Item extends d.Table {}
  decorate(Item, { name: [d.Field("string")] });
  d.RegisterTable("items", "gm")(Item);
  await d.RegisterSchema("gm");
  const Model = d.BasicDataModel(Item);
  const first = d.GetModel(Model);
  const again = d.GetModel(Model);
  const tenant = d.GetModel(Model, "t1");
  const tenantAgain = d.GetModel(Model, "t1");
  const other = d.GetModel(Model, "t2");
  const everywhere = d.GetModel(Model, iface.CROSS_INSTANCE);
  await first.insert({ name: "default" });
  await tenant.insert({ name: "tenant one" });
  await other.insert({ name: "tenant two" });
  const OtherModel = d.BasicDataModel(Item);
  class Custom { constructor(database) { this.database = database; this.table = database.table("things"); } }
  Custom.schemaName = "manual";
  new iface.Schema("manual", { things: { fields: {}, indexes: {} } });
  const custom = d.GetModel(Custom);
  class Lost { constructor(database) { this.database = database; } }
  Lost.schemaName = "absent-schema";
  return {
    cache: [first === again, tenant === tenantAgain, first !== tenant, tenant !== other, everywhere !== first, first instanceof Model, d.GetModel(OtherModel) !== first],
    defaultSees: (await first.getAll()).map((row) => row.name),
    tenantSees: (await tenant.getAll()).map((row) => row.name),
    otherSees: (await other.getAll()).map((row) => row.name),
    everywhereSees: (await everywhere.getAll()).map((row) => row.name).sort(),
    customSchema: [custom instanceof Custom, d.GetModel(Custom) === custom],
    lost: caught(() => d.GetModel(Lost)),
    statics: [Model.schemaName, Model.tableClass === Item],
  };
`;

const FACTORY = `
  class Plain extends d.Table {}
  decorate(Plain, { name: [d.Field("string")] });
  const missingName = caught(() => d.BasicDataModel(Plain));
  new iface.Schema("fac", { explicit: { fields: { name: "string" }, indexes: {} } });
  const Explicit = d.BasicDataModel(Plain, "explicit");
  const model = new Explicit(iface.Schema.get("fac").instance());
  const [id] = await model.insert({ name: "named by argument" });
  class Registered extends d.Table {}
  d.RegisterTable("registered", "fac")(Registered);
  const Derived = d.BasicDataModel(Registered);
  const Overridden = d.BasicDataModel(Registered, "explicit");
  return { missingName, explicit: (await model.get(id)).name, schemaOfPlain: Explicit.schemaName ?? "undefined", schemaOfRegistered: Derived.schemaName, overriddenTable: await new Overridden(iface.Schema.get("fac").instance()).getAll().then((rows) => rows.length) };
`;

const EXTEND = `
  class User extends d.Table {}
  decorate(User, { email: [d.Field("string"), d.Index()], name: [d.Field("string")], status: [d.Field("string"), d.Index()] });
  d.RegisterTable("users", "ext")(User);
  await d.RegisterSchema("ext");
  const UserModelBase = d.BasicDataModel(User);
  class CustomUserModel extends UserModelBase {
    async findActive() {
      return this.table.filter((u) => u.key("status").eq("active")).then((rows) => rows.map((row) => CustomUserModel.fromDatabase(row)).filter((user) => user !== undefined));
    }
    async register(email, name) {
      const existing = await this.getBy("email", email);
      if (existing.length > 0) throw new Error("Email already in use");
      return this.insert({ email, name, status: "active" });
    }
  }
  const model = d.GetModel(CustomUserModel);
  await model.register("a@example.com", "Ada");
  const duplicate = await rejection(model.register("a@example.com", "Again"));
  await model.insert({ email: "z@example.com", name: "Zed", status: "suspended" });
  const active = await model.findActive();
  return { isModel: model instanceof CustomUserModel, duplicate, active: active.map((user) => [user instanceof User, user.name]) };
`;

const COMPOUND = `
  class Event extends d.Table {}
  decorate(Event, {
    kind: [d.Field("string"), d.Index({ group: "triple" })],
    day: [d.Field("string"), d.Index({ group: "triple" })],
    room: [d.Field("string"), d.Index({ group: "triple" })],
    title: [d.Field("string")],
  });
  d.RegisterTable("events", "tri")(Event);
  await d.RegisterSchema("tri");
  const model = d.GetModel(d.BasicDataModel(Event));
  await model.insert([
    { kind: "talk", day: "mon", room: "A", title: "one" },
    { kind: "talk", day: "mon", room: "B", title: "two" },
    { kind: "talk", day: "tue", room: "A", title: "three" },
    { kind: "demo", day: "mon", room: "A", title: "four" },
  ]);
  await sleep(2500);
  const titles = async (...keys) => (await model.getBy("triple", ...keys)).map((row) => row.title).sort();
  return { exact: await titles("talk", "mon", "A"), other: await titles("talk", "mon", "B"), none: await titles("talk", "tue", "B"), order: await titles("mon", "talk", "A") };
`;

const PARTIAL = `
  const secretKey = "${KEY}";
  class UserProfile extends d.Table.with(d.EncryptionModifier, d.HashModifier, d.LocalizationModifier) {}
  decorate(UserProfile, {
    privateInfo: [d.Encrypted({ secretKey }), d.Field("any")],
    password: [d.Hashed(), d.Field("string")],
    bio: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
  });
  d.RegisterTable("profiles", "partial")(UserProfile);
  await d.RegisterSchema("partial");
  const model = d.GetModel(d.BasicDataModel(UserProfile));
  const profile = new UserProfile();
  profile.privateInfo = { address: "1 Main St", phoneNumber: "555" };
  profile.password = "old-password";
  profile.localize("en").bio = "Hello";
  const [id] = await model.insert(profile);
  const before = Object.keys((await rawTable("partial", "profiles").get(id))._internal.data).sort();
  await model.update(id, { password: "new-password" });
  const row = await model.get(id);
  const after = Object.keys((await rawTable("partial", "profiles").get(id))._internal.data).sort();
  return {
    before,
    after,
    passwordReplaced: [await row.testHashAsync("password", "new-password"), await row.testHashAsync("password", "old-password")],
    privateInfo: row.privateInfo ?? "lost",
    bio: row.localize("en").bio ?? "lost",
  };
`;

const PLAIN_DATA = `
  class Account extends d.Table.with(d.EncryptionModifier, d.HashModifier, d.LocalizationModifier) {}
  decorate(Account, {
    name: [d.Field("string"), d.Index()],
    secret: [d.Encrypted({ secretKey: "${KEY}" }), d.Field("any")],
    password: [d.Hashed(), d.Field("string")],
    title: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
  });
  d.RegisterTable("accounts", "plain")(Account);
  await d.RegisterSchema("plain");
  const model = d.GetModel(d.BasicDataModel(Account));
  const account = new Account();
  account._id = "a1";
  account.name = "Ann";
  account.secret = { token: "t" };
  account.password = "pw";
  account.localize("en").title = "Hello";
  const [id] = await model.insert(account);
  const loaded = await model.get(id);
  const everyPath = [await model.get(id), (await model.getBy("name", "Ann"))[0], (await model.getAll())[0]];
  const pathResults = [];
  for (const row of everyPath) pathResults.push([row instanceof Account, row.name, row.secret, await row.testHashAsync("password", "pw"), row.localize("en").title]);
  const plain = d.toPlainData(loaded);
  const unlocked = d.toPlainData(loaded.localize("en"));
  const events = [];
  return {
    pathResults,
    keys: Object.keys(plain).filter((key) => key !== "_instance").sort(),
    noInternal: !("_internal" in plain),
    name: plain.name,
    secret: plain.secret,
    passwordIsHash: typeof plain.password === "string" && plain.password !== "pw" && plain.password.length > 20,
    lockedTitle: plain.title ?? "undefined",
    unlockedTitle: unlocked.title,
    json: JSON.parse(JSON.stringify(loaded)).secret,
    stillLocked: Object.keys(loaded._internal.data).sort(),
    notAnInstance: !(plain instanceof Account),
  };
`;

export const MODEL_JOURNEYS = {
  crud: scenario({
    title: "a model inserts, reads, updates and deletes rows and answers ids and counts",
    body: CRUD,
    printed: "{\"insertedIds\":[1,2,true],\"got\":[true,true,\"Alice\"],\"missing\":\"undefined\",\"instances\":[true,true,true,true,3],\"admins\":[\"Alice\"],\"byEmail\":[\"Bob\"],\"everyone\":[\"Alice\",\"Bob\",\"Carol\"],\"updatedById\":1,\"updatedByObject\":1,\"updatedMissing\":0,\"noKey\":{\"name\":\"AssertionError\",\"message\":\"Missing primary key in object update.\"},\"deleted\":1,\"deletedMissing\":0,\"left\":[\"Alice Liddell\",\"Robert\"]}",
    stored: [{ name: "the rows left", expression: "$DB.getCollection('crud__users').find().sort({ email: 1 }).toArray().map((r) => [r.email, r.name, r.role])", expected: "[[\"alice@example.com\",\"Alice Liddell\",\"admin\"],[\"bob@example.com\",\"Robert\",\"user\"]]" }],
  }),
  conversion: scenario({
    title: "fromPlainData, fromDatabase and toDatabase convert without saving, and reads convert their rows",
    body: CONVERSION,
    printed: "{\"fromPlain\":[true,\"s3cret\",\"Ann\"],\"sameInstance\":true,\"storedShape\":[false,[\"_id\",\"_internal\",\"name\"],3,true],\"plainDataShape\":[false,[\"_id\",\"name\"]],\"nullIsUndefined\":[true,true],\"emptyObjectIsAnInstance\":true,\"copyNotSame\":[true,true,false,\"Cy\"],\"afterConversions\":0,\"read\":[true,\"hidden\"],\"direct\":[false,\"Dee\",true],\"getAllConverted\":true,\"getByConverted\":[1,true,\"hidden\",\"hidden\",\"hidden\"]}",
    stored: [{ name: "the one saved account", expression: "$DB.getCollection('cnv__accounts').find().toArray().map((r) => [r.name, Object.keys(r._internal.data), r._internal.data.secret.length])", expected: "[[\"Dee\",[\"secret\"],3]]" }],
  }),
  validation: scenario({
    title: "validate checks the io-ts codecs, and insert and update refuse invalid input only when asked",
    body: VALIDATION,
    printed: "{\"valid\":{\"ok\":true},\"invalid\":{\"ok\":false,\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"notAnObject\":{\"ok\":false,\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"partialOk\":{\"ok\":true},\"partialEmpty\":{\"ok\":true},\"partialBad\":{\"ok\":false,\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"tokenSkipped\":{\"ok\":true},\"optIn\":1,\"refused\":{\"message\":\"validation failed: name (expected a string), age (invalid age)\",\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"batchRefused\":{\"message\":\"validation failed: name (expected a string), age (invalid age)\",\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"patched\":1,\"patchRefused\":{\"message\":\"validation failed: age (invalid age)\",\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"objectPatchRefused\":{\"message\":\"validation failed: name (expected a string)\",\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"}]},\"unvalidatedPatch\":1,\"oddMessages\":{\"ok\":false,\"errors\":[{\"field\":\"a\",\"message\":\"after a hole\"},{\"field\":\"b\",\"message\":\"invalid b\"}]},\"missingRequired\":{\"message\":\"validation failed: age (invalid age)\",\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"missingInArray\":{\"message\":\"validation failed: age (invalid age)\",\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"missingStored\":[42,\"Bob\"],\"afterInsert\":\"  padded  \",\"storedLabels\":[\"  again  \",\" a \",\" b \",43],\"presentUndefined\":{\"ok\":false,\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"absentAge\":{\"ok\":true}}",
    stored: [{ name: "the people", expression: "$DB.getCollection('val__people').find().sort({ name: 1 }).toArray().map((r) => [r.name, r.age])", expected: "[[42,\"anything\"],[\"Bob\",\"old\"]]" }],
  }),
  "get-model": scenario({
    title: "GetModel caches one model per class and instance id, and keeps each instance's rows apart",
    body: GET_MODEL,
    printed: "{\"cache\":[true,true,true,true,true,true,true],\"defaultSees\":[\"default\"],\"tenantSees\":[\"tenant one\"],\"otherSees\":[\"tenant two\"],\"everywhereSees\":[\"default\",\"tenant one\",\"tenant two\"],\"customSchema\":[true,true],\"lost\":\"Schema not found for 'absent-schema'\",\"statics\":[\"gm\",true]}",
    stored: [{ name: "the rows by instance", expression: "$DB.getCollection('gm__items').find().sort({ name: 1 }).toArray().map((r) => [r.name, r._instance])", expected: "[[\"default\",null],[\"tenant one\",\"t1\"],[\"tenant two\",\"t2\"]]" }],
  }),
  "plain-data": scenario({ title: "toPlainData gives unlocked values without _internal, and leaves a still-locked field undefined", body: PLAIN_DATA, printed: "{\"pathResults\":[[true,\"Ann\",{\"token\":\"t\"},true,\"Hello\"],[true,\"Ann\",{\"token\":\"t\"},true,\"Hello\"],[true,\"Ann\",{\"token\":\"t\"},true,\"Hello\"]],\"keys\":[\"_id\",\"name\",\"password\",\"secret\",\"title\"],\"noInternal\":true,\"name\":\"Ann\",\"secret\":{\"token\":\"t\"},\"passwordIsHash\":true,\"lockedTitle\":\"undefined\",\"unlockedTitle\":\"Hello\",\"json\":{\"token\":\"t\"},\"stillLocked\":[\"password\",\"secret\",\"title\"],\"notAnInstance\":true}" }),
  "compound-get-by": scenario({ title: "getBy matches a compound index of three fields by its keys in field order", body: COMPOUND, printed: "{\"exact\":[\"one\"],\"other\":[\"two\"],\"none\":[],\"order\":[]}" }),
  "partial-update-keeps-modified-fields": scenario({
    title: "KNOWN FINDING AntelopeJS/interface-database-decorators#80, fails until fixed: update with one field keeps the row's other encrypted, hashed and localized fields",
    body: PARTIAL,
    printed: "{\"before\":[\"bio\",\"password\",\"privateInfo\"],\"after\":[\"bio\",\"password\",\"privateInfo\"],\"passwordReplaced\":[true,false],\"privateInfo\":{\"address\":\"1 Main St\",\"phoneNumber\":\"555\"},\"bio\":\"Hello\"}",
  }),
  "model-factory": scenario({ title: "BasicDataModel takes its table name from the argument or from RegisterTable", body: FACTORY, printed: "{\"missingName\":\"tableName must be provided or set via @RegisterTable\",\"explicit\":\"named by argument\",\"schemaOfPlain\":\"undefined\",\"schemaOfRegistered\":\"fac\",\"overriddenTable\":1}" }),
  "extend-model": scenario({
    title: "a subclass of a model adds query methods that use the model's table and conversions",
    body: EXTEND,
    printed: "{\"isModel\":true,\"duplicate\":{\"name\":\"Error\",\"message\":\"Email already in use\"},\"active\":[[true,\"Ada\"]]}",
    stored: [{ name: "the users", expression: "$DB.getCollection('ext__users').find().sort({ email: 1 }).toArray().map((r) => [r.email, r.status])", expected: "[[\"a@example.com\",\"active\"],[\"z@example.com\",\"suspended\"]]" }],
  }),
} satisfies { [id: string]: Journey };
