import { KEY } from "./models-conversion.ts";

export const GET_MODEL = `
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

export const FACTORY = `
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

export const EXTEND = `
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

export const COMPOUND = `
  class Event extends d.Table {}
  decorate(Event, {
    kind: [d.Field("string"), d.Index({ group: "triple" })],
    day: [d.Field("string"), d.Index({ group: "triple" })],
    room: [d.Field("string"), d.Index({ group: "triple" })],
    title: [d.Field("string")],
  });
  d.RegisterTable("events", "tri")(Event);
  class Seat extends d.Table {}
  decorate(Seat, {
    row: [d.Field("number"), d.Index({ group: "spot" })],
    col: [d.Field("number"), d.Index({ group: "spot" })],
    open: [d.Field("boolean"), d.Index({ group: "spot" })],
    label: [d.Field("string")],
  });
  d.RegisterTable("seats", "tri")(Seat);
  await d.RegisterSchema("tri");
  const seats = d.GetModel(d.BasicDataModel(Seat));
  await seats.insert([{ row: 1, col: 2, open: true, label: "1-2" }, { row: 2, col: 1, open: true, label: "2-1" }, { row: 1, col: 2, open: false, label: "1-2 shut" }]);
  const model = d.GetModel(d.BasicDataModel(Event));
  await model.insert([
    { kind: "talk", day: "mon", room: "A", title: "one" },
    { kind: "talk", day: "mon", room: "B", title: "two" },
    { kind: "talk", day: "tue", room: "A", title: "three" },
    { kind: "demo", day: "mon", room: "A", title: "four" },
  ]);
  await sleep(2500);
  const titles = async (...keys) => (await model.getBy("triple", ...keys)).map((row) => row.title).sort();
  const labels = async (...keys) => (await seats.getBy("spot", ...keys)).map((row) => row.label).sort();
  const constant = (value) => iface.ValueProxy.constant(value);
  return {
    exact: await titles("talk", "mon", "A"), other: await titles("talk", "mon", "B"), none: await titles("talk", "tue", "B"), order: await titles("mon", "talk", "A"),
    numbers: await labels(1, 2, true), numbersAsText: await labels("1", "2", true), shut: await labels(1, 2, false), proxies: await labels(constant(2), constant(1), constant(true)),
  };
`;

export const GET_BY_KEYS = `
  class Player extends d.Table {}
  decorate(Player, { name: [d.Field("string"), d.Index()], rank: [d.Field("number"), d.Index()], active: [d.Field("boolean"), d.Index()] });
  d.RegisterTable("players", "keys")(Player);
  await d.RegisterSchema("keys");
  const model = d.GetModel(d.BasicDataModel(Player));
  await model.insert([{ name: "Ann", rank: 2, active: true }, { name: "Bob", rank: 12, active: false }, { name: "Cid", rank: 2, active: false }]);
  await untilIndexed("keys__players", ["name", "rank", "active"]);
  const names = async (index, ...keys) => (await model.getBy(index, ...keys)).map((row) => [row instanceof Player, row.name]).sort();
  return {
    number: await names("rank", 2),
    numberIsNotText: await names("rank", "2"),
    boolean: await names("active", false),
    proxy: await names("name", iface.ValueProxy.constant("Bob")),
    numberProxy: await names("rank", iface.ValueProxy.constant(12)),
  };
`;

export const PARTIAL = `
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

export const PLAIN_DATA = `
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