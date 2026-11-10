import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";
import { CONVERSION, VALIDATION } from "./models-conversion.ts";
import { COMPOUND, EXTEND, FACTORY, GET_BY_KEYS, GET_MODEL, PARTIAL, PLAIN_DATA } from "./models-lookup.ts";

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
    printed: "{\"plainLocked\":[true,[\"secret\"]],\"fromPlain\":[true,\"s3cret\",\"Ann\"],\"sameInstance\":true,\"storedShape\":[false,[\"_id\",\"_internal\",\"name\"],3,true],\"plainDataShape\":[false,[\"_id\",\"name\"]],\"nullIsUndefined\":[true,true],\"emptyObjectIsAnInstance\":true,\"copyNotSame\":[true,true,false,\"Cy\"],\"afterConversions\":0,\"read\":[true,\"hidden\"],\"direct\":[false,\"Dee\",true],\"getAllConverted\":true,\"getByConverted\":[1,true,\"hidden\",\"hidden\",\"hidden\"]}",
    stored: [{ name: "the one saved account", expression: "$DB.getCollection('cnv__accounts').find().toArray().map((r) => [r.name, Object.keys(r._internal.data), r._internal.data.secret.length])", expected: "[[\"Dee\",[\"secret\"],3]]" }],
  }),
  validation: scenario({
    title: "validate checks the io-ts codecs, and insert and update refuse invalid input only when asked",
    body: VALIDATION,
    printed: "{\"valid\":{\"ok\":true},\"invalid\":{\"ok\":false,\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"notAnObject\":{\"ok\":false,\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"partialOk\":{\"ok\":true},\"partialEmpty\":{\"ok\":true},\"partialBad\":{\"ok\":false,\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"tokenSkipped\":{\"ok\":true},\"optIn\":1,\"refused\":{\"isError\":true,\"message\":\"validation failed: name (expected a string), age (invalid age)\",\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"batchRefused\":{\"isError\":true,\"message\":\"validation failed: name (expected a string), age (invalid age)\",\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"},{\"field\":\"age\",\"message\":\"invalid age\"}]},\"patched\":1,\"patchRefused\":{\"isError\":true,\"message\":\"validation failed: age (invalid age)\",\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"objectPatchRefused\":{\"isError\":true,\"message\":\"validation failed: name (expected a string)\",\"errors\":[{\"field\":\"name\",\"message\":\"expected a string\"}]},\"unvalidatedPatch\":1,\"oddMessages\":{\"ok\":false,\"errors\":[{\"field\":\"a\",\"message\":\"after a hole\"},{\"field\":\"b\",\"message\":\"invalid b\"}]},\"missingRequired\":{\"isError\":true,\"message\":\"validation failed: age (invalid age)\",\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"missingInArray\":{\"isError\":true,\"message\":\"validation failed: age (invalid age)\",\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"missingStored\":[42,\"Bob\"],\"afterInsert\":\"  padded  \",\"storedLabels\":[\"  again  \",\" a \",\" b \",43],\"presentUndefined\":{\"ok\":false,\"errors\":[{\"field\":\"age\",\"message\":\"invalid age\"}]},\"absentAge\":{\"ok\":true}}",
    stored: [{ name: "the people", expression: "$DB.getCollection('val__people').find().sort({ name: 1 }).toArray().map((r) => [r.name, r.age])", expected: "[[42,\"anything\"],[\"Bob\",\"old\"]]" }],
  }),
  "get-model": scenario({
    title: "GetModel caches one model per class and instance id, and keeps each instance's rows apart",
    body: GET_MODEL,
    printed: "{\"cache\":[true,true,true,true,true,true,true],\"defaultSees\":[\"default\"],\"tenantSees\":[\"tenant one\"],\"otherSees\":[\"tenant two\"],\"everywhereSees\":[\"default\",\"tenant one\",\"tenant two\"],\"customSchema\":[true,true],\"lost\":\"Schema not found for 'absent-schema'\",\"statics\":[\"gm\",true]}",
    stored: [{ name: "the rows by instance", expression: "$DB.getCollection('gm__items').find().sort({ name: 1 }).toArray().map((r) => [r.name, r._instance])", expected: "[[\"default\",null],[\"tenant one\",\"t1\"],[\"tenant two\",\"t2\"]]" }],
  }),
  "plain-data": scenario({ title: "toPlainData gives unlocked values without _internal, and leaves a still-locked field undefined", body: PLAIN_DATA, printed: "{\"pathResults\":[[true,\"Ann\",{\"token\":\"t\"},true,\"Hello\"],[true,\"Ann\",{\"token\":\"t\"},true,\"Hello\"],[true,\"Ann\",{\"token\":\"t\"},true,\"Hello\"]],\"keys\":[\"_id\",\"name\",\"password\",\"secret\",\"title\"],\"noInternal\":true,\"name\":\"Ann\",\"secret\":{\"token\":\"t\"},\"passwordIsHash\":true,\"lockedTitle\":\"undefined\",\"unlockedTitle\":\"Hello\",\"json\":{\"token\":\"t\"},\"stillLocked\":[\"password\",\"secret\",\"title\"],\"notAnInstance\":true}" }),
  "compound-get-by": scenario({ title: "getBy matches a compound index of three fields by its keys in field order, with text, number, boolean and value proxy keys", body: COMPOUND, printed: "{\"indexed\":true,\"exact\":[\"one\"],\"other\":[\"two\"],\"none\":[],\"order\":[],\"numbers\":[\"1-2\"],\"numbersAsText\":[],\"shut\":[\"1-2 shut\"],\"proxies\":[\"2-1\"]}" }),
  "get-by-keys": scenario({ title: "getBy matches a number, a boolean and a value proxy key as the index holds it, and a text key does not match a number", body: GET_BY_KEYS, printed: "{\"indexed\":true,\"number\":[[true,\"Ann\"],[true,\"Cid\"]],\"numberIsNotText\":[],\"boolean\":[[true,\"Bob\"],[true,\"Cid\"]],\"proxy\":[[true,\"Bob\"]],\"numberProxy\":[[true,\"Bob\"]]}" }),
  "partial-update-keeps-modified-fields": scenario({
    title: "update with one field keeps the row's other encrypted, hashed and localized fields",
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
