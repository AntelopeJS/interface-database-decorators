export const KEY = "12345678901234567890123456789012";

export const CONVERSION = `
  class Account extends d.Table.with(d.EncryptionModifier) {}
  decorate(Account, { name: [d.Field("string"), d.Index()], secret: [d.Encrypted({ secretKey: "${KEY}" }), d.Field("string")] });
  d.RegisterTable("accounts", "cnv")(Account);
  await d.RegisterSchema("cnv");
  const Model = d.BasicDataModel(Account);
  const fromPlain = Model.fromPlainData({ _id: "a1", name: "Ann", secret: "s3cret" });
  const sameInstance = Model.fromPlainData(fromPlain) === fromPlain;
  const stored = Model.toDatabase(fromPlain);
  const fromPlainDirect = Model.toDatabase({ _id: "a2", name: "Bea" });
  const plainWithSecret = Model.toDatabase({ _id: "a4", name: "Eve", secret: "plain" });
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
    plainLocked: [plainWithSecret.secret === undefined, Object.keys(plainWithSecret._internal?.data ?? {})],
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

export const VALIDATION = `
  class Person extends d.Table {}
  decorate(Person, { name: [d.Field(${STR})], age: [d.Field(${NUM})], nick: [d.Field("string")], extra: [] });
  d.RegisterTable("people", "val")(Person);
  await d.RegisterSchema("val");
  const Model = d.BasicDataModel(Person);
  const people = d.GetModel(Model);
  const errorOf = async (promise) => { try { await promise; return null; } catch (error) { return { isError: error instanceof Error, message: error.message, errors: error.errors }; } };
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
