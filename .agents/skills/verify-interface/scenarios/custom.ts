import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

const PRELUDE = `
  const { MakePropertyDecorator } = require(require.resolve("@antelopejs/interface-core/decorators", { paths: [dist] }));
`;

const ONE_WAY = `${PRELUDE}
  class PrefixHashModifier extends d.OneWayModifier {
    autolock = true;
    lock(_locked, value) { if (value === undefined) return undefined; return crypto.createHash(this.options.algorithm || "sha256").update(JSON.stringify(value)).digest("hex"); }
    [d.MixinSymbol] = class {};
  }
  const PrefixHashed = MakePropertyDecorator((target, propertyKey, options) => { d.attachModifier(target.constructor, PrefixHashModifier, propertyKey, options || {}); });
  class Doc extends d.Table {}
  decorate(Doc, { title: [d.Field("string")], digest: [PrefixHashed(), d.Field("string")], strong: [PrefixHashed({ algorithm: "sha512" }), d.Field("string")] });
  d.RegisterTable("docs", "oneway")(Doc);
  await d.RegisterSchema("oneway");
  const model = d.GetModel(d.BasicDataModel(Doc));
  const [id] = await model.insert({ title: "t", digest: "value", strong: "value" });
  const raw = await rawTable("oneway", "docs").get(id);
  const loaded = await model.get(id);
  return {
    tested: [d.testValue(loaded, "digest", "value"), d.testValue(loaded, "digest", "other"), d.testValue(loaded, "strong", "value")],
    stored: [raw._internal.data.digest === crypto.createHash("sha256").update(JSON.stringify("value")).digest("hex"), raw._internal.data.strong === crypto.createHash("sha512").update(JSON.stringify("value")).digest("hex")],
    afterOneWay: caught(() => { class T extends d.Table.with(d.HashModifier, d.EncryptionModifier) {} decorate(T, { pin: [d.Hashed(), d.Encrypted({ secretKey: "12345678901234567890123456789012" })] }); }),
    beforeOneWay: caught(() => { class T extends d.Table.with(d.HashModifier, d.EncryptionModifier) {} decorate(T, { pin: [d.Encrypted({ secretKey: "12345678901234567890123456789012" }), d.Hashed()] }); }),
    secondOneWay: caught(() => { class Twice extends d.Table {} decorate(Twice, { f: [PrefixHashed(), PrefixHashed()] }); }),
  };
`;

const TWO_WAY = `${PRELUDE}
  class Base64Modifier extends d.TwoWayModifier {
    autolock = true;
    autounlock = true;
    lock(_locked, value) { if (value === undefined) return undefined; return (this.options.prefix || "b64-") + Buffer.from(JSON.stringify(value)).toString("base64"); }
    unlock(locked) { if (typeof locked !== "string") return undefined; const prefix = this.options.prefix || "b64-"; return JSON.parse(Buffer.from(locked.substring(prefix.length), "base64").toString("utf8")); }
    unlockrequest(data) { return data; }
    [d.MixinSymbol] = class {};
  }
  const Base64Encoded = MakePropertyDecorator((target, propertyKey, options) => { d.attachModifier(target.constructor, Base64Modifier, propertyKey, options || {}); });
  class Doc extends d.Table {}
  decorate(Doc, { title: [d.Field("string")], body: [Base64Encoded(), d.Field("any")], tagged: [Base64Encoded({ prefix: "x:" }), d.Field("any")] });
  d.RegisterTable("docs", "twoway")(Doc);
  await d.RegisterSchema("twoway");
  const model = d.GetModel(d.BasicDataModel(Doc));
  const [id] = await model.insert({ title: "t", body: { a: [1, 2] }, tagged: "plain" });
  await rawTable("twoway", "docs").insert({ _id: "odd", title: "odd", _internal: { meta: {}, data: { body: 42 } } }).run();
  const read = await model.get(id);
  const odd = await model.get("odd");
  const raw = await rawTable("twoway", "docs").get(id);
  return { read: [read.body, read.tagged], storedBody: raw._internal.data.body, storedTagged: raw._internal.data.tagged, notAString: odd.body ?? "undefined" };
`;

const CONTAINER = `${PRELUDE}
  class PickModifier extends d.ContainerModifier {
    [d.MixinSymbol] = class { pick(key) { d.unlock(this, PickModifier, undefined, key); return this; } };
  }
  const Picked = MakePropertyDecorator((target, propertyKey, options) => { d.attachModifier(target.constructor, PickModifier, propertyKey, options || {}); });
  class Doc extends d.Table.with(PickModifier) {}
  decorate(Doc, { values: [Picked(), d.Field("any")] });
  const doc = new Doc();
  doc.pick("a").values = 1;
  doc.pick("b").values = 2;
  const both = doc.pick("*").values;
  doc.pick("a").values = 3;
  const afterOverwrite = doc.pick("*").values;
  Object.assign(doc.pick("*"), { values: { z: 26 } });
  const replaced = doc.pick("*").values;
  return { both, afterOverwrite, replaced, byKey: [doc.pick("z").values, doc.pick("missing").values ?? "undefined", doc.pick("constructor").values ?? "undefined"] };
`;

const CONTAINER_QUERY = `${PRELUDE}
  class PickModifier extends d.ContainerModifier {
    [d.MixinSymbol] = class {};
  }
  const Picked = MakePropertyDecorator((target, propertyKey, options) => { d.attachModifier(target.constructor, PickModifier, propertyKey, options || {}); });
  class Doc extends d.Table.with(PickModifier) {}
  decorate(Doc, { values: [Picked(), d.Field("any")] });
  d.RegisterTable("docs", "ctquery")(Doc);
  await d.RegisterSchema("ctquery");
  const seed = (id, values) => rawTable("ctquery", "docs").insert({ _id: id, _internal: { meta: {}, data: { values } } }).run();
  await seed("one", { a: 1, b: 2 });
  await seed("two", { a: 2, b: 1 });
  await seed("only-b", { b: 1 });
  const table = rawTable("ctquery", "docs");
  const where = async (key, value) => (await table.filter((row) => d.unlockrequest(Doc, row, "values", [{ modifier: PickModifier, args: [key] }]).eq(value))).map((row) => row._id).sort();
  return { a1: await where("a", 1), a2: await where("a", 2), b1: await where("b", 1), b2: await where("b", 2), c1: await where("c", 1) };
`;

const METADATA = `${PRELUDE}
  const share = { key: Symbol("shared") };
  class Shared { constructor() { this.list = []; } }
  Shared.key = share.key;
  class Copied { constructor() { this.list = []; } static inherit(parent) { const copy = new Copied(); copy.list = [...parent.list]; return copy; } }
  Copied.key = Symbol("copied");
  class A {}
  class B extends A {}
  d.getMetadata(A, Shared).list.push("x");
  d.getMetadata(A, Copied).list.push("x");
  const sharedB = d.getMetadata(B, Shared);
  const copiedB = d.getMetadata(B, Copied);
  copiedB.list.push("y");
  const upgraded = { upgrade: (stored) => (stored.version ? stored : Object.assign(new Copied(), stored, { version: 2 })) };
  class Aged { constructor() { this.list = []; } static upgrade(stored) { return Object.hasOwn(stored, "version") ? stored : Object.assign(new Aged(), stored, { version: 2 }); } }
  Aged.key = Symbol("aged");
  class Old {}
  Reflect.defineMetadata(Aged.key, { list: ["legacy"] }, Old);
  const first = d.getMetadata(Old, Aged);
  const second = d.getMetadata(Old, Aged);
  class Current {}
  d.RegisterTable("currents", "meta")(Current);
  const current = d.getMetadata(Current, d.DatumStaticMetadata);
  const currentAgain = d.getMetadata(Current, d.DatumStaticMetadata);
  return {
    identity: [current === currentAgain, d.DatumStaticMetadata.upgrade(current) === current, Aged.upgrade(first) === first],
    shared: [sharedB === d.getMetadata(A, Shared), sharedB.list],
    copied: [copiedB === d.getMetadata(A, Copied), copiedB.list, d.getMetadata(A, Copied).list],
    upgrade: [first instanceof Aged, first.version, first.list, first === second],
  };
`;

const LEGACY_METADATA = `
  class Old {}
  Reflect.defineMetadata(d.DatumStaticMetadata.key, { schemaName: "legacy", tableName: "olds", indexes: {}, crossInstanceIndexes: new Set(), fields: {}, primary: "_id" }, Old);
  const upgraded = d.getMetadata(Old, d.DatumStaticMetadata);
  const again = d.getMetadata(Old, d.DatumStaticMetadata);
  d.Field("string")(Old.prototype, "code");
  d.Index({ unique: true })(Old.prototype, "code");
  d.RegisterTable("olds", "legacy")(Old);
  await d.RegisterSchema("legacy");
  const model = d.GetModel(d.BasicDataModel(Old));
  await model.insert({ code: "A" });
  const refused = await refusedDuplicate(model, (attempt) => ({ code: "A" }));
  return {
    upgraded: [upgraded instanceof d.DatumStaticMetadata, upgraded.uniqueIndexes instanceof Set, upgraded === again, upgraded.tableName],
    definition: iface.Schema.get("legacy").definition.olds.indexes,
    uniqueEnforced: refused && refused.name,
  };
`;

const EVENTS = `${PRELUDE}
  const log = [];
  const shape = (args) => args.length + ":" + args.map((value) => (value !== null && typeof value === "object" ? Object.keys(value).filter((key) => key !== "_instance").sort().join("+") : String(value))).join(";");
  class Spy extends d.Modifier {
    fromPlainData(object, field, ...args) { log.push(["fromPlainData", field, this instanceof Spy, object.constructor.name, shape(args)]); }
    toPlainData(object, field, ...args) { log.push(["toPlainData", field, this instanceof Spy, object.constructor.name, shape(args)]); }
    fromDatabase(object, field, ...args) { log.push(["fromDatabase", field, this instanceof Spy, object.constructor.name, shape(args)]); }
    toDatabase(object, field, ...args) { log.push(["toDatabase", field, this instanceof Spy, object.constructor.name, shape(args)]); args[0].handled = "by-handler"; }
    insert(object, field, ...args) { log.push(["insert", field, this instanceof Spy, object.constructor.name, shape(args)]); }
    update(object, field, ...args) { log.push(["update", field, this instanceof Spy, object.constructor.name, shape(args)]); }
    [d.MixinSymbol] = class {};
  }
  const Spied = MakePropertyDecorator((target, propertyKey, options) => { d.attachModifier(target.constructor, Spy, propertyKey, options || {}); });
  class Doc extends d.Table {}
  decorate(Doc, { note: [Spied(), d.Field("string")] });
  d.RegisterTable("docs", "events")(Doc);
  await d.RegisterSchema("events");
  const model = d.GetModel(d.BasicDataModel(Doc));
  const phase = (_name, entries) => entries.map((entry) => entry.join("/"));
  const mark = () => log.splice(0);
  const [id] = await model.insert({ note: "n" });
  const onInsert = phase("insert", mark());
  await model.update(id, { note: "m" });
  const onUpdate = phase("update", mark());
  await model.get(id);
  const onRead = phase("read", mark());
  await model.getAll();
  const onReadAll = phase("readAll", mark());
  const instance = await model.get(id);
  mark();
  d.toPlainData(instance);
  const onPlain = phase("plain", mark());
  const storedByHandler = (await rawTable("events", "docs").get(id)).handled ?? "undefined";
  const plainAccessor = Object.getOwnPropertyDescriptor(Doc.prototype, "note");
  return { onInsert, onUpdate, onRead, onReadAll, onPlain, storedByHandler, eventsOnlyKeepPlainValue: plainAccessor === undefined };
`;

const HELPERS = `
  class Profile extends d.Table.with(d.HashModifier, d.LocalizationModifier) {}
  decorate(Profile, {
    password: [d.Hashed(), d.Field("string")],
    title: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
    summary: [d.Localized(), d.Field("string")],
    plain: [d.Field("string")],
  });
  d.RegisterTable("profiles", "helpers")(Profile);
  class Other extends d.Table {}
  d.RegisterTable("others", "helpers")(Other);
  const row = new Profile();
  const names = { hashed: d.getModifiedFields(row, d.HashModifier), localized: d.getModifiedFields(row, d.LocalizationModifier), none: d.getModifiedFields(row, d.EncryptionModifier) };
  row.title = "floating";
  const floatingRead = row.title;
  const floatingStored = Object.keys(d.toDatabase(row)).sort();
  d.unlock(row, d.LocalizationModifier, ["title"], "fr");
  const afterUnlock = [row.title, row.localize("fr").title, row.localize("en").title ?? "undefined"];
  const stored = d.toDatabase(row);
  const lockedKeys = Object.keys(stored._internal.data).sort();
  row.localize("fr").summary = "résumé";
  d.unlock(row, d.LocalizationModifier, ["title"], "en");
  const restricted = [row.title ?? "undefined", row.summary ?? "undefined"];
  const tables = d.getTablesForSchema("helpers");
  await d.RegisterSchema("helpers");
  const bound = d.getMetadata(Profile, d.DatumStaticMetadata);
  class Early extends Profile {}
  const earlyBefore = d.getMetadata(Early, d.DatumStaticMetadata);
  const copiedArrays = [earlyBefore.indexes !== bound.indexes, earlyBefore.fields !== bound.fields, earlyBefore.primary, bound.schema !== undefined, earlyBefore.schema === undefined];
  const parentMeta = d.getMetadata(Profile, d.DatumStaticMetadata);
  class Child extends Profile {}
  const own = d.getMetadata(Child, d.DatumStaticMetadata, false);
  class Child2 extends Profile {}
  const inherited = d.getMetadata(Child2, d.DatumStaticMetadata);
  return {
    names,
    floatingRead,
    floatingStored,
    afterUnlock,
    lockedKeys,
    restricted,
    copiedArrays,
    tables: [Object.keys(tables).sort(), tables.profiles === Profile, d.getTablesForSchema("nothing-here") ?? "undefined"],
    metadata: [parentMeta.tableName, own.tableName ?? "undefined", inherited.tableName, own === inherited, inherited === parentMeta, d.getMetadata(Profile, d.DatumStaticMetadata) === parentMeta],
  };
`;

export const CUSTOM_JOURNEYS = {
  "one-way-modifier": scenario({ title: "a custom OneWayModifier transforms a value when it is written", body: ONE_WAY, printed: "{\"tested\":[true,false,true],\"stored\":[true,true],\"afterOneWay\":\"Adding Modifier EncryptionModifier on T.pin after a One-Way Modifier, please review your ordering.\",\"beforeOneWay\":null,\"secondOneWay\":\"Attempted adding Modifier PrefixHashModifier on Twice.f but it already has a One-Way Modifier\"}" }),
  "two-way-modifier": scenario({
    title: "a custom TwoWayModifier stores a transformed value and unlocks it on read",
    body: TWO_WAY,
    printed: "{\"read\":[{\"a\":[1,2]},\"plain\"],\"storedBody\":\"b64-eyJhIjpbMSwyXX0=\",\"storedTagged\":\"x:InBsYWluIg==\",\"notAString\":\"undefined\"}",
    stored: [{ name: "the stored encodings", expression: "$DB.getCollection('twoway__docs').find({ title: 't' }).toArray().map((r) => [r._internal.data.body, r._internal.data.tagged])", expected: "[[\"b64-eyJhIjpbMSwyXX0=\",\"x:InBsYWluIg==\"]]" }],
  }),
  "modifier-helpers": scenario({ title: "getModifiedFields, unlock, lock, floating values, getMetadata and getTablesForSchema do what their TSDoc says", body: HELPERS, printed: "{\"names\":{\"hashed\":[\"password\"],\"localized\":[\"title\",\"summary\"],\"none\":[]},\"floatingRead\":\"floating\",\"floatingStored\":[\"_internal\"],\"afterUnlock\":[\"floating\",\"floating\",\"undefined\"],\"lockedKeys\":[\"title\"],\"restricted\":[\"undefined\",\"r\u00e9sum\u00e9\"],\"copiedArrays\":[true,true,\"_id\",true,true],\"tables\":[[\"others\",\"profiles\"],true,\"undefined\"],\"metadata\":[\"profiles\",\"undefined\",\"profiles\",false,false,true]}" }),
  "container-query": scenario({ title: "ContainerModifier.unlockrequest uses its key, so a query reads one entry of the stored record", body: CONTAINER_QUERY, printed: "{\"a1\":[\"one\"],\"a2\":[\"two\"],\"b1\":[\"only-b\",\"two\"],\"b2\":[\"one\"],\"c1\":[]}" }),
  "metadata-class": scenario({ title: "a metadata class without inherit is shared with the subclass, one with inherit is copied, and upgrade runs on stored metadata", body: METADATA, printed: "{\"identity\":[true,true,true],\"shared\":[true,[\"x\"]],\"copied\":[false,[\"x\",\"y\"],[\"x\"]],\"upgrade\":[true,2,[\"legacy\"],true]}" }),
  "legacy-metadata": scenario({ title: "metadata stored without uniqueIndexes is upgraded and unique indexes still register", body: LEGACY_METADATA, printed: "{\"upgraded\":[true,true,true,\"olds\"],\"definition\":{\"code\":{\"fields\":null,\"unique\":true}},\"uniqueEnforced\":\"DuplicateKeyError\"}" }),
  "container-modifier": scenario({ title: "a ContainerModifier keeps values by key and treats the wildcard key as the whole record", body: CONTAINER, printed: "{\"both\":{\"a\":1,\"b\":2},\"afterOverwrite\":{\"a\":3,\"b\":2},\"replaced\":{\"z\":26},\"byKey\":[26,\"undefined\",\"undefined\"]}" }),
  "modifier-events": scenario({ title: "a modifier's event methods run for inserts, updates and conversions, and an events-only modifier leaves the field plain", body: EVENTS, printed: "{\"onInsert\":[\"fromPlainData/note/true/Doc/1:note\",\"insert/note/true/Doc/0:\",\"toDatabase/note/true/Doc/1:_internal+note\"],\"onUpdate\":[\"fromPlainData/note/true/Doc/1:note\",\"update/note/true/Doc/0:\",\"toDatabase/note/true/Doc/1:_internal+note\"],\"onRead\":[\"fromDatabase/note/true/Doc/1:_id+_internal+handled+note\"],\"onReadAll\":[\"fromDatabase/note/true/Doc/1:_id+_internal+handled+note\"],\"onPlain\":[\"toPlainData/note/true/Doc/1:_id+handled+note\"],\"storedByHandler\":\"by-handler\",\"eventsOnlyKeepPlainValue\":true}" }),
} satisfies { [id: string]: Journey };
