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

const EVENTS = `${PRELUDE}
  const log = [];
  class Spy extends d.Modifier {
    fromPlainData(object, field) { log.push(["fromPlainData", field, this instanceof Spy, object.constructor.name]); }
    toPlainData(object, field) { log.push(["toPlainData", field, this instanceof Spy, object.constructor.name]); }
    fromDatabase(object, field) { log.push(["fromDatabase", field, this instanceof Spy, object.constructor.name]); }
    toDatabase(object, field) { log.push(["toDatabase", field, this instanceof Spy, object.constructor.name]); }
    insert(object, field) { log.push(["insert", field, this instanceof Spy, object.constructor.name]); }
    update(object, field) { log.push(["update", field, this instanceof Spy, object.constructor.name]); }
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
  const plainAccessor = Object.getOwnPropertyDescriptor(Doc.prototype, "note");
  return { onInsert, onUpdate, onRead, onReadAll, onPlain, eventsOnlyKeepPlainValue: plainAccessor === undefined };
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
    tables: [Object.keys(tables).sort(), tables.profiles === Profile, d.getTablesForSchema("nothing-here") ?? "undefined"],
    metadata: [parentMeta.tableName, own.tableName ?? "undefined", inherited.tableName, own === inherited, inherited === parentMeta, d.getMetadata(Profile, d.DatumStaticMetadata) === parentMeta],
  };
`;

export const CUSTOM_JOURNEYS = {
  "one-way-modifier": scenario({ title: "a custom OneWayModifier transforms a value when it is written", body: ONE_WAY, printed: "{\"tested\":[true,false,true],\"stored\":[true,true],\"secondOneWay\":\"Attempted adding Modifier PrefixHashModifier on Twice.f but it already has a One-Way Modifier\"}" }),
  "two-way-modifier": scenario({
    title: "a custom TwoWayModifier stores a transformed value and unlocks it on read",
    body: TWO_WAY,
    printed: "{\"read\":[{\"a\":[1,2]},\"plain\"],\"storedBody\":\"b64-eyJhIjpbMSwyXX0=\",\"storedTagged\":\"x:InBsYWluIg==\",\"notAString\":\"undefined\"}",
    stored: [{ name: "the stored encodings", expression: "$DB.getCollection('twoway__docs').find({ title: 't' }).toArray().map((r) => [r._internal.data.body, r._internal.data.tagged])", expected: "[[\"b64-eyJhIjpbMSwyXX0=\",\"x:InBsYWluIg==\"]]" }],
  }),
  "modifier-helpers": scenario({ title: "getModifiedFields, unlock, lock, floating values, getMetadata and getTablesForSchema do what their TSDoc says", body: HELPERS, printed: "{\"names\":{\"hashed\":[\"password\"],\"localized\":[\"title\",\"summary\"],\"none\":[]},\"floatingRead\":\"floating\",\"floatingStored\":[\"_internal\"],\"afterUnlock\":[\"floating\",\"floating\",\"undefined\"],\"lockedKeys\":[\"title\"],\"restricted\":[\"undefined\",\"r\u00e9sum\u00e9\"],\"tables\":[[\"others\",\"profiles\"],true,\"undefined\"],\"metadata\":[\"profiles\",\"undefined\",\"profiles\",false,false,true]}" }),
  "container-modifier": scenario({ title: "a ContainerModifier keeps values by key and treats the wildcard key as the whole record", body: CONTAINER, printed: "{\"both\":{\"a\":1,\"b\":2},\"afterOverwrite\":{\"a\":3,\"b\":2},\"replaced\":{\"z\":26},\"byKey\":[26,\"undefined\",\"undefined\"]}" }),
  "modifier-events": scenario({ title: "a modifier's event methods run for inserts, updates and conversions, and an events-only modifier leaves the field plain", body: EVENTS, printed: "{\"onInsert\":[\"fromPlainData/note/true/Doc\",\"insert/note/true/Doc\",\"toDatabase/note/true/Doc\"],\"onUpdate\":[\"fromPlainData/note/true/Doc\",\"update/note/true/Doc\",\"toDatabase/note/true/Doc\"],\"onRead\":[\"fromDatabase/note/true/Doc\"],\"onReadAll\":[\"fromDatabase/note/true/Doc\"],\"onPlain\":[\"toPlainData/note/true/Doc\"],\"eventsOnlyKeepPlainValue\":true}" }),
} satisfies { [id: string]: Journey };
