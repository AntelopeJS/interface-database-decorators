import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

const REGISTER = `
  class Item extends d.Table {}
  decorate(Item, { name: [d.Field("string"), d.Index()] });
  d.RegisterTable("items", "reg")(Item);
  class Box extends d.Table {}
  decorate(Box, { label: [d.Field("string")] });
  d.RegisterTable("boxes", "reg")(Box);
  class Early extends d.Table {}
  d.RegisterTable("early", "preexisting")(Early);
  const noTables = await rejection(d.RegisterSchema("nothing-registered"));
  const beforeBinding = caught(() => d.GetModel(d.BasicDataModel(Item)));
  const returned = await d.RegisterSchema("reg");
  const schema = iface.Schema.get("reg");
  const afterBinding = d.GetModel(d.BasicDataModel(Item)) !== undefined;
  const again = await d.RegisterSchema("reg");
  new iface.Schema("preexisting", { early: { fields: {}, indexes: {} } });
  const viaSchemaName = d.GetModel(d.BasicDataModel(Early)) !== undefined;
  await d.GetModel(d.BasicDataModel(Item)).insert({ name: "one" });
  await d.GetModel(d.BasicDataModel(Box)).insert({ label: "red" });
  return {
    noTables: noTables && noTables.message,
    beforeBinding,
    returned: returned ?? "undefined",
    again: again ?? "undefined",
    tables: Object.keys(schema.definition),
    afterBinding,
    viaSchemaName,
    tableNameIsNotASchema: iface.Schema.get("items") === undefined,
  };
`;

const FIXTURES = `
  const roles = [{ _id: "admin", name: "Administrator" }, { _id: "user", name: "Standard User" }];
  class Role extends d.Table {}
  decorate(Role, { name: [d.Field("string")] });
  d.Fixture(() => roles)(Role);
  d.RegisterTable("roles", "fx")(Role);
  class Setting extends d.Table {}
  decorate(Setting, { key: [d.Field("string")], value: [d.Field("string")] });
  d.Fixture(async () => ({ key: "theme", value: "dark" }))(Setting);
  d.RegisterTable("settings", "fx")(Setting);
  class Plan extends d.Table {}
  decorate(Plan, { label: [d.Field("string")] });
  d.Fixture(async () => [{ label: "free" }, { label: "pro" }, { label: "team" }])(Plan);
  d.RegisterTable("plans", "fx")(Plan);
  class Nothing extends d.Table {}
  d.Fixture(() => undefined)(Nothing);
  d.RegisterTable("nothing", "fx")(Nothing);
  class Loose extends d.Table {}
  decorate(Loose, { name: [d.Field("string")] });
  d.Fixture(() => [{ _id: "loose", name: "never inserted" }])(Loose);
  class Stamped extends d.Table.with(d.HashModifier) {}
  decorate(Stamped, { secret: [d.Hashed(), d.Field("string")], created: [d.CreationTime(), d.Field("date")] });
  d.Fixture(() => [{ _id: "s1", secret: "hunter2" }, { _id: "s2", secret: "hunter3" }])(Stamped);
  d.RegisterTable("stamped", "fx")(Stamped);
  await d.RegisterSchema("fx");
  const count = (name) => rawTable("fx", name).count();
  const first = { roles: await count("roles"), settings: await count("settings"), plans: await count("plans"), nothing: await count("nothing") };
  await rawTable("fx", "roles").get("user").delete();
  await d.RegisterSchema("fx");
  const afterSecondStart = await count("roles");
  const ids = (await rawTable("fx", "plans")).map((row) => row._id).sort();
  const stampedRows = [await rawTable("fx", "stamped").get("s1"), await rawTable("fx", "stamped").get("s2")];
  const stamped = stampedRows[0];
  return {
    first,
    afterSecondStart,
    plans: ids,
    unregisteredClassProvisioned: Object.keys(iface.Schema.get("fx").definition).includes("loose"),
    hashedAtInsert: stampedRows.map((row) => row._internal.data.secret.startsWith("$" + "scrypt" + "$ln=15,r=8,p=3$") && !row._internal.data.secret.includes("hunter")),
    insertEventFired: stamped.created !== undefined,
  };
`;

const FIXTURE_RACE = `
  class Seed extends d.Table {}
  decorate(Seed, { name: [d.Field("string")] });
  d.Fixture(() => [{ name: "a" }, { name: "b" }])(Seed);
  d.RegisterTable("seeds", "race")(Seed);
  class Child extends Seed {}
  d.RegisterTable("kids", "race")(Child);
  let seen = null;
  class Spy extends d.Table {}
  decorate(Spy, { name: [d.Field("string")] });
  d.Fixture((cls) => { seen = cls.name; return [{ name: "spy" }]; })(Spy);
  class SpyChild extends Spy {}
  d.RegisterTable("spies", "race")(SpyChild);
  await Promise.all([d.RegisterSchema("race"), d.RegisterSchema("race")]);
  const rows = (await rawTable("race", "seeds")).map((row) => row._id).sort();
  const kids = (await rawTable("race", "kids")).map((row) => row._id).sort();
  return { rows, kids, generatorReceived: seen };
`;

const TABLE_ACCESS = `
  class Item extends d.Table {}
  decorate(Item, { name: [d.Field("string")] });
  d.RegisterTable("items", "acc")(Item);
  class Nameless extends d.Table {}
  class Ghost extends d.Table {}
  d.RegisterTable("ghosts", "never-registered")(Ghost);
  const unbound = caught(() => Ghost.table());
  const nameless = caught(() => Nameless.table());
  const beforeRegister = caught(() => Item.table());
  await d.RegisterSchema("acc");
  await Item.table().insert({ name: "default" }).run();
  await Item.table("tenant-1").insert({ name: "tenant" }).run();
  await Item.table(iface.CROSS_INSTANCE).count();
  const held = iface.Schema.get("acc").instance("held");
  await Item.table(held).insert({ name: "held" }).run();
  return {
    unbound,
    nameless,
    beforeRegister,
    defaultCount: await Item.table().count(),
    tenantCount: await Item.table("tenant-1").count(),
    crossCount: await Item.table(iface.CROSS_INSTANCE).count(),
    heldCount: await Item.table(held).count(),
  };
`;

const FIXTURE_MIXED = `
  class Mixed extends d.Table {}
  decorate(Mixed, { name: [d.Field("string")] });
  d.Fixture(() => [{ _id: "keep", name: "a" }, { name: "b" }, { name: "c" }])(Mixed);
  d.RegisterTable("mixed", "mix")(Mixed);
  class Single extends d.Table {}
  decorate(Single, { name: [d.Field("string")] });
  d.Fixture(() => ({ name: "only" }))(Single);
  d.RegisterTable("single", "mix")(Single);
  class Last extends d.Table {}
  decorate(Last, { name: [d.Field("string")] });
  d.Fixture(() => [{ name: "x" }, { _id: "named", name: "y" }])(Last);
  d.RegisterTable("last", "mix")(Last);
  await d.RegisterSchema("mix");
  const ids = async (table) => (await rawTable("mix", table)).map((row) => row._id).sort();
  return { mixed: await ids("mixed"), last: await ids("last"), single: await ids("single") };
`;

const FOREIGN = `
  class Item extends d.Table {}
  decorate(Item, { name: [d.Field("string")] });
  d.RegisterTable("items", "home")(Item);
  await d.RegisterSchema("home");
  new iface.Schema("away", { items: { fields: { name: "string" }, indexes: {} } });
  const away = iface.Schema.get("away").instance("away-1");
  await Item.table(away).insert({ _id: "foreign", name: "stored away" }).run();
  await Item.table().insert({ _id: "local", name: "stored home" }).run();
  return { homeCount: await Item.table().count(), awayCount: await Item.table(away).count() };
`;

export const REGISTRATION_JOURNEYS = {
  "register-schema": scenario({
    title: "RegisterSchema provisions the registered tables, binds the classes and refuses an unknown schema",
    body: REGISTER,
    printed: "{\"noTables\":\"No tables registered for schema 'nothing-registered'\",\"beforeBinding\":\"Item is not bound to a schema: call RegisterSchema(\\\"reg\\\") in the module that declares it\",\"returned\":\"undefined\",\"again\":\"undefined\",\"tables\":[\"items\",\"boxes\"],\"afterBinding\":true,\"viaSchemaName\":true,\"tableNameIsNotASchema\":true}",
    stored: [{ name: "the collections of the schema", expression: "$DB.getCollectionNames().filter((n) => n.startsWith('reg__')).sort()", expected: "[\"reg__boxes\",\"reg__items\"]" }],
  }),
  fixtures: scenario({
    title: "fixtures fill an empty table once, with generated ids and the same conversion as an insert",
    body: FIXTURES,
    printed: "{\"first\":{\"roles\":2,\"settings\":1,\"plans\":3,\"nothing\":0},\"afterSecondStart\":1,\"plans\":[\"plans:fixture:0\",\"plans:fixture:1\",\"plans:fixture:2\"],\"unregisteredClassProvisioned\":false,\"hashedAtInsert\":[true,true],\"insertEventFired\":true}",
    stored: [
      { name: "the plan rows", expression: "$DB.getCollection('fx__plans').find({}, { name: 0 }).sort({ _id: 1 }).toArray().map((r) => [r._id, r.label])", expected: "[[\"plans:fixture:0\",\"free\"],[\"plans:fixture:1\",\"pro\"],[\"plans:fixture:2\",\"team\"]]" },
      { name: "the stamped row", expression: "$DB.getCollection('fx__stamped').find().sort({ _id: 1 }).toArray().map((r) => [r._id, r._internal.data.secret.startsWith('$' + 'scrypt' + '$ln=15,r=8,p=3$'), r._internal.data.secret.includes('hunter'), r.created !== undefined])", expected: "[[\"plans:fixture:0\",\"free\"],[\"plans:fixture:1\",\"pro\"],[\"plans:fixture:2\",\"team\"]]" },
    ],
  }),
  "fixture-race": scenario({
    title: "two starts on one empty table write each fixture row once, and a subclass gets its parent's fixture",
    body: FIXTURE_RACE,
    printed: "{\"rows\":[\"seeds:fixture:0\",\"seeds:fixture:1\"],\"kids\":[\"kids:fixture:0\",\"kids:fixture:1\"],\"generatorReceived\":\"SpyChild\"}",
    stored: [{ name: "the seed rows", expression: "$DB.getCollection('race__seeds').find().sort({ _id: 1 }).toArray().map((r) => [r._id, r.name])", expected: "[[\"seeds:fixture:0\",\"a\"],[\"seeds:fixture:1\",\"b\"]]" }],
  }),
  "fixture-ids-mixed": scenario({
    title: "a fixture mixing rows with and without an id keeps the ids it has and numbers the others by position",
    body: FIXTURE_MIXED,
    printed: "{\"mixed\":[\"keep\",\"mixed:fixture:1\",\"mixed:fixture:2\"],\"last\":[\"last:fixture:0\",\"named\"],\"single\":[\"single:fixture:0\"]}",
    stored: [{ name: "the mixed ids", expression: "$DB.getCollection('mix__mixed').find().sort({ _id: 1 }).toArray().map((r) => r._id)", expected: "[\"keep\",\"mixed:fixture:1\",\"mixed:fixture:2\"]" }],
  }),
  "table-foreign-instance": scenario({
    title: "Table.table with a schema instance takes the table from that instance as is, even of another schema",
    body: FOREIGN,
    printed: "{\"homeCount\":1,\"awayCount\":1}",
    stored: [
      { name: "the home rows", expression: "$DB.getCollection('home__items').find().toArray().map((r) => r._id)", expected: "[\"local\"]" },
      { name: "the away rows", expression: "$DB.getCollection('away__items').find().toArray().map((r) => [r._id, r._instance])", expected: "[[\"foreign\",\"away-1\"]]" },
    ],
  }),
  "table-access": scenario({
    title: "Table.table opens the bound table for the default instance, an instance id, all instances or a held instance",
    body: TABLE_ACCESS,
    printed: "{\"unbound\":\"Ghost is not bound to a schema: call RegisterSchema(\\\"never-registered\\\") in the module that declares it\",\"nameless\":\"Nameless has no table name: decorate it with @RegisterTable\",\"beforeRegister\":\"Item is not bound to a schema: call RegisterSchema(\\\"acc\\\") in the module that declares it\",\"defaultCount\":1,\"tenantCount\":1,\"crossCount\":3,\"heldCount\":1}",
    stored: [{ name: "the rows by instance", expression: "$DB.getCollection('acc__items').find().sort({ name: 1 }).toArray().map((r) => [r.name, r._instance])", expected: "[[\"default\",null],[\"held\",\"held\"],[\"tenant\",\"tenant-1\"]]" }],
  }),
} satisfies { [id: string]: Journey };
