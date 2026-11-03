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
  return {
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
    toPlainData(object, field) { log.push(["toPlainData", field]); }
    fromDatabase(object, field) { log.push(["fromDatabase", field]); }
    toDatabase(object, field) { log.push(["toDatabase", field]); }
    insert(object, field) { log.push(["insert", field]); }
    update(object, field) { log.push(["update", field]); }
    [d.MixinSymbol] = class {};
  }
  const Spied = MakePropertyDecorator((target, propertyKey, options) => { d.attachModifier(target.constructor, Spy, propertyKey, options || {}); });
  class Doc extends d.Table {}
  decorate(Doc, { note: [Spied(), d.Field("string")] });
  d.RegisterTable("docs", "events")(Doc);
  await d.RegisterSchema("events");
  const model = d.GetModel(d.BasicDataModel(Doc));
  const phase = (_name, entries) => entries.map((entry) => entry[0]);
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

export const CUSTOM_JOURNEYS = {
  "one-way-modifier": scenario({ title: "a custom OneWayModifier transforms a value when it is written", body: ONE_WAY, printed: "{\"stored\":[true,true],\"secondOneWay\":\"Attempted adding Modifier PrefixHashModifier on Twice.f but it already has a One-Way Modifier\"}" }),
  "two-way-modifier": scenario({
    title: "a custom TwoWayModifier stores a transformed value and unlocks it on read",
    body: TWO_WAY,
    printed: "{\"read\":[{\"a\":[1,2]},\"plain\"],\"storedBody\":\"b64-eyJhIjpbMSwyXX0=\",\"storedTagged\":\"x:InBsYWluIg==\",\"notAString\":\"undefined\"}",
    stored: [{ name: "the stored encodings", expression: "$DB.getCollection('twoway__docs').find({ title: 't' }).toArray().map((r) => [r._internal.data.body, r._internal.data.tagged])", expected: "[[\"b64-eyJhIjpbMSwyXX0=\",\"x:InBsYWluIg==\"]]" }],
  }),
  "container-modifier": scenario({ title: "a ContainerModifier keeps values by key and treats the wildcard key as the whole record", body: CONTAINER, printed: "{\"both\":{\"a\":1,\"b\":2},\"afterOverwrite\":{\"a\":3,\"b\":2},\"replaced\":{\"z\":26},\"byKey\":[26,\"undefined\",\"undefined\"]}" }),
  "modifier-events": scenario({ title: "a modifier's event methods run for inserts, updates and conversions, and an events-only modifier leaves the field plain", body: EVENTS, printed: "{\"onInsert\":[\"fromPlainData\",\"insert\",\"toDatabase\"],\"onUpdate\":[\"fromPlainData\",\"update\",\"toDatabase\"],\"onRead\":[\"fromDatabase\"],\"onReadAll\":[\"fromDatabase\"],\"onPlain\":[\"toPlainData\"],\"eventsOnlyKeepPlainValue\":true}" }),
} satisfies { [id: string]: Journey };
