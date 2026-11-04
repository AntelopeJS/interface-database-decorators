import type { Journey } from "@antelopejs/tooling-configs/verify";

import { scenario } from "../runner.ts";

const INDEX_OPTIONS = `
  class User extends d.Table {}
  decorate(User, {
    email: [d.Field("string"), d.Index({ unique: true })],
    first: [d.Field("string"), d.Index({ group: "name", crossInstance: true })],
    last: [d.Field("string"), d.Index({ group: "name" })],
    age: [d.Index(), d.Field("number")],
    note: [],
  });
  d.RegisterTable("users", "idx")(User);
  await d.RegisterSchema("idx");
  const definition = iface.Schema.get("idx").definition;
  const Model = d.BasicDataModel(User);
  const model = d.GetModel(Model);
  const other = d.GetModel(Model, "tenant-2");
  await model.insert({ email: "a@x", first: "Ada", last: "Lovelace", age: 36 });
  const refused = await refusedDuplicate(model, (attempt) => ({ email: "a@x", first: "Bob", last: "Brown", age: 40 + attempt }));
  const duplicate = refused && { name: refused.name, message: refused.message };
  const recognised = [iface.IsDuplicateKeyError(refused), iface.IsDuplicateKeyError(new Error("other"))];
  const otherInstance = await other.insert({ email: "a@x", first: "Ada", last: "Lovelace", age: 36 });
  const groupRows = await model.getBy("name", "Ada", "Lovelace");
  const singleRows = await model.getBy("age", 36);
  const converted = [groupRows.every((row) => row instanceof User), singleRows.every((row) => row instanceof User), groupRows.length, singleRows.length];
  const byGroup = groupRows.map((row) => row.email);
  const bySingle = singleRows.map((row) => row.first);
  const between = (await rawTable("idx", "users").between("age", 30, 38)).map((row) => row.first);
  const symbolKey = caught(() => d.Index()({}, Symbol("k")));
  const built = await untilIndexed("idx__users", ["email__i", "name__i", "age__i", "name"]);
  return { converted, indexed: built !== null, definition: definition.users, duplicate, recognised, otherInstanceStored: otherInstance.length, byGroup, bySingle, between, symbolKey };
`;

const GROUP_FLAGS = `
  class Pair extends d.Table {}
  decorate(Pair, {
    a: [d.Field("string"), d.Index({ group: "ab" })],
    b: [d.Field("string"), d.Index({ group: "ab", unique: true })],
    c: [d.Field("string"), d.Index({ group: "cd", crossInstance: true })],
    e: [d.Field("string"), d.Index({ group: "cd" })],
    f: [d.Field("string"), d.Index({ group: "ef" })],
    g: [d.Field("string"), d.Index({ group: "ef", crossInstance: true })],
    h: [d.Field("string"), d.Index({ group: "ef" })],
    i: [d.Field("string"), d.Index({ group: "ij", unique: true })],
    j: [d.Field("string"), d.Index({ group: "ij" })],
    k: [d.Field("string"), d.Index({ group: "plain" })],
    l: [d.Field("string"), d.Index({ group: "plain" })],
  });
  d.RegisterTable("pairs", "grp")(Pair);
  await d.RegisterSchema("grp");
  const model = d.GetModel(d.BasicDataModel(Pair));
  await model.insert({ a: "1", b: "x", c: "p", e: "q" });
  const refusedKey = await refusedDuplicate(model, (attempt) => ({ a: "1", b: "x", c: "r" + attempt, e: "s" }));
  const sameKey = refusedKey && { name: refusedKey.name, message: refusedKey.message };
  const otherSecond = await model.insert({ a: "1", b: "y", c: "p", e: "q" });
  return { indexes: iface.Schema.get("grp").definition.pairs.indexes, sameKey, otherSecond: otherSecond.length };
`;

const FIELD_TYPES = `
  const codec = { _tag: "codec", name: "Positive", decode: (u) => (typeof u === "number" && u > 0 ? { _tag: "Right", right: u } : { _tag: "Left", left: [{ message: "not positive" }] }), encode: (a) => a, is: (u) => typeof u === "number" };
  class Order extends d.Table {}
  decorate(Order, {
    id: [d.Field("string")],
    tags: [d.Field(["string"])],
    address: [d.Field({ street: "string", geo: { lat: "number", lng: "number" } })],
    total: [d.Field(codec), d.Index()],
    lateIndex: [d.Index(), d.Field("number")],
    plain: [],
  });
  d.RegisterTable("orders", "fld")(Order);
  await d.RegisterSchema("fld");
  const fields = iface.Schema.get("fld").definition.orders.fields;
  return {
    names: Object.keys(fields),
    id: fields.id,
    tags: fields.tags,
    address: fields.address,
    codecIsTheSameObject: fields.total === codec,
    lateIndexType: fields.lateIndex,
    indexes: Object.keys(iface.Schema.get("fld").definition.orders.indexes),
  };
`;

const RELATION = `
  class Author extends d.Table {}
  decorate(Author, { name: [d.Field("string")] });
  class Post extends d.Table {}
  decorate(Post, {
    authorId: [d.Index(), d.Field("string"), d.Relation({ to: () => Author })],
    tagIds: [d.Relation({ to: () => Author, toField: "name", many: true }), d.Field(["string"])],
    title: [d.Field("string")],
  });
  d.RegisterTable("authors", "rel")(Author);
  d.RegisterTable("posts", "rel")(Post);
  await d.RegisterSchema("rel");
  const metadata = d.getMetadata(Post, d.RelationStaticMetadata).relations;
  const posts = d.GetModel(d.BasicDataModel(Post));
  const ids = await posts.insert({ authorId: "nobody", tagIds: ["ghost"], title: "Dangling" });
  const stored = await posts.get(ids[0]);
  const definition = iface.Schema.get("rel").definition.posts;
  class Child extends Post {}
  decorate(Child, { editorId: [d.Field("string"), d.Relation({ to: () => Author })] });
  return {
    relationFields: Object.keys(metadata),
    authorTarget: metadata.authorId.to() === Author,
    authorToField: metadata.authorId.toField ?? null,
    tagMany: metadata.tagIds.many,
    tagToField: metadata.tagIds.toField,
    dangling: [stored.authorId, stored.tagIds],
    fieldsKept: Object.keys(definition.fields),
    childRelations: Object.keys(d.getMetadata(Child, d.RelationStaticMetadata).relations),
    parentRelations: Object.keys(d.getMetadata(Post, d.RelationStaticMetadata).relations),
  };
`;

const INHERITANCE = `
  class Cross extends d.Table {}
  decorate(Cross, { a: [d.Field("string"), d.Index({ group: "ab" })], b: [d.Field("string"), d.Index({ group: "ab", crossInstance: true, unique: true })], c: [d.Field("string"), d.Index({ group: "c" })] });
  d.RegisterTable("crosses", "inh")(Cross);
  class Base extends d.Table {}
  decorate(Base, { createdAt: [d.Field("date")] });
  d.RegisterTable("people", "inh")(Base);
  class Person extends Base {}
  decorate(Person, { email: [d.Field("string"), d.Index({ unique: true })] });
  class Employee extends Person {}
  decorate(Employee, { badge: [d.Field("string"), d.Index()] });
  class Sub extends Cross {}
  decorate(Sub, { extra: [d.Field("string")] });
  d.RegisterTable("subs", "inh")(Sub);
  class Contractor extends Base {}
  decorate(Contractor, { rate: [d.Field("number")] });
  const meta = (cls) => { const m = d.getMetadata(cls, d.DatumStaticMetadata); return { table: m.tableName ?? null, schema: m.schemaName ?? null, fields: Object.keys(m.fields), indexes: Object.keys(m.indexes), unique: [...m.uniqueIndexes], cross: [...m.crossInstanceIndexes] }; };
  await d.RegisterSchema("inh");
  const built = iface.Schema.get("inh").definition;
  class Late extends Cross {}
  const late = [d.getMetadata(Late, d.DatumStaticMetadata).schema === undefined, d.getMetadata(Cross, d.DatumStaticMetadata).schema !== undefined, d.getMetadata(Late, d.DatumStaticMetadata).tableName];
  return { late, built: [built.subs.indexes.ab, built.crosses.indexes.ab], base: meta(Base), person: meta(Person), employee: meta(Employee), contractor: meta(Contractor), cross: meta(Cross), sub: meta(Sub) };
`;

const WITH_SUBCLASS = `
  class User extends d.Table {
    greet() { return "hi " + this.name; }
  }
  decorate(User, { name: [d.Field("string")] });
  class Admin extends User.with(d.HashModifier) {}
  decorate(Admin, { password: [d.Hashed(), d.Field("string")] });
  d.RegisterTable("admins", "withsub")(Admin);
  await d.RegisterSchema("withsub");
  const admin = new Admin();
  admin.name = "Root";
  const model = d.GetModel(d.BasicDataModel(Admin));
  const [id] = await model.insert({ name: "Root", password: "pw" });
  const row = await model.get(id);
  return {
    isUser: [admin instanceof User, admin instanceof d.Table, Object.getPrototypeOf(User.with(d.HashModifier)) === User],
    methods: [admin.greet(), typeof admin.testHash, typeof admin.testHashAsync, typeof admin.isHashOutdated, typeof User.prototype.testHash],
    stored: [row.greet(), await row.testHashAsync("password", "pw")],
  };
`;

const WITH_FIELDS = `
  class User extends d.Table {}
  decorate(User, { name: [d.Field("string")], email: [d.Field("string"), d.Index()] });
  class Admin extends User.with(d.HashModifier) {}
  decorate(Admin, { password: [d.Hashed(), d.Field("string")] });
  d.RegisterTable("admins", "withfields")(Admin);
  await d.RegisterSchema("withfields");
  const definition = iface.Schema.get("withfields").definition.admins;
  return { fields: Object.keys(d.getMetadata(Admin, d.DatumStaticMetadata).fields).sort(), built: Object.keys(definition.fields).sort(), indexes: Object.keys(definition.indexes) };
`;

const SUBCLASS_MODIFIERS = `
  class Parent extends d.Table.with(d.HashModifier) {}
  decorate(Parent, { name: [d.Field("string")], born: [d.CreationTime(), d.Field("date")] });
  d.RegisterTable("parents", "submod")(Parent);
  class Child extends Parent {}
  decorate(Child, { extra: [d.CreationTime(), d.Field("date")], secret: [d.Hashed(), d.Field("string")] });
  d.RegisterTable("children", "submod")(Child);
  await d.RegisterSchema("submod");
  const parentRow = new Parent();
  const childRow = new Child();
  const parents = d.GetModel(d.BasicDataModel(Parent));
  const children = d.GetModel(d.BasicDataModel(Child));
  const [parentId] = await parents.insert({ name: "p" });
  const [childId] = await children.insert({ name: "c", secret: "s" });
  const parentStored = await rawTable("submod", "parents").get(parentId);
  const childStored = await rawTable("submod", "children").get(childId);
  const meta = d.getMetadata(Parent, d.DatumStaticMetadata);
  class Fixtured extends Parent {}
  d.Fixture(() => [{ name: "only the child" }])(Fixtured);
  return {
    parentModified: [d.getModifiedFields(parentRow, d.HashModifier), d.getModifiedFields(parentRow, d.AutoDateModifier)],
    childModified: [d.getModifiedFields(childRow, d.HashModifier), d.getModifiedFields(childRow, d.AutoDateModifier)],
    parentStored: [Object.keys(parentStored).filter((key) => ["born", "extra"].includes(key)).sort(), parentStored._internal === undefined || Object.keys(parentStored._internal.data ?? {})],
    childStored: [Object.keys(childStored).filter((key) => ["born", "extra"].includes(key)).sort(), Object.keys(childStored._internal.data)],
    parentFixture: meta.generator === undefined,
    childSeesParentFields: Object.keys(d.getMetadata(Child, d.DatumStaticMetadata).fields),
  };
`;

const WITH = `
  class Plain extends d.Table {}
  class Hashing extends d.Table.with(d.HashModifier) {}
  class Both extends d.Table.with(d.HashModifier, d.LocalizationModifier) {}
  const has = (cls, name) => typeof new cls()[name] === "function";
  const sub = d.Table.with(d.HashModifier);
  return {
    plainHasTestHash: has(Plain, "testHash"),
    hashingHas: [has(Hashing, "testHash"), has(Hashing, "testHashAsync"), has(Hashing, "isHashOutdated"), has(Hashing, "localize")],
    bothHas: [has(Both, "testHash"), has(Both, "localize")],
    isTableSubclass: new Hashing() instanceof d.Table,
    tableItselfUntouched: typeof d.Table.prototype.testHash,
    subIsASubclass: sub.prototype instanceof d.Table,
  };
`;

const COMBINE = `
  const secretKey = "12345678901234567890123456789012";
  class UserProfile extends d.Table.with(d.EncryptionModifier, d.HashModifier, d.LocalizationModifier) {}
  decorate(UserProfile, {
    privateInfo: [d.Encrypted({ secretKey }), d.Field("any")],
    password: [d.Hashed(), d.Field("string")],
    bio: [d.Localized({ fallbackLocale: "en" }), d.Field("string")],
  });
  d.RegisterTable("profiles", "combo")(UserProfile);
  await d.RegisterSchema("combo");
  const model = d.GetModel(d.BasicDataModel(UserProfile));
  const profile = new UserProfile();
  profile.privateInfo = { address: "1 Main St", phoneNumber: "555" };
  profile.password = "pw";
  profile.localize("en").bio = "Hello";
  profile.localize("fr").bio = "Bonjour";
  const [id] = await model.insert(profile);
  const row = await model.get(id);
  const raw = await rawTable("combo", "profiles").get(id);
  return {
    stored: Object.keys(raw._internal.data).sort(),
    privateInfo: row.privateInfo,
    password: [await row.testHashAsync("password", "pw"), await row.testHashAsync("password", "no")],
    bio: [row.localize("fr").bio, row.localize("de").bio],
    mixins: [typeof row.testHash, typeof row.localize],
  };
`;

export const TABLE_JOURNEYS = {
  "index-options": scenario({
    title: "Field and Index reach the database as fields and plain, compound, cross-instance and unique indexes",
    body: INDEX_OPTIONS,
    printed: "{\"converted\":[true,true,1,1],\"indexed\":true,\"definition\":{\"fields\":{\"email\":\"string\",\"first\":\"string\",\"last\":\"string\",\"age\":\"number\"},\"indexes\":{\"email\":{\"fields\":null,\"unique\":true},\"name\":{\"fields\":[\"first\",\"last\"],\"crossInstance\":true},\"age\":{\"fields\":null}}},\"duplicate\":{\"name\":\"DuplicateKeyError\",\"message\":\"Duplicate key on index \\\"email\\\" (email)\"},\"recognised\":[true,false],\"otherInstanceStored\":1,\"byGroup\":[\"a@x\"],\"bySingle\":[\"Ada\"],\"between\":[\"Ada\"],\"symbolKey\":\"@Index on Symbol(k): a database index names a field, never a symbol\"}",
    stored: [{ name: "the indexes of the users collection", expression: "$DB.getCollection('idx__users').getIndexes().map((i) => [i.name, i.unique === true]).sort()", expected: "[[\"_id_\",false],[\"age__i\",false],[\"email__i\",true],[\"name\",false],[\"name__i\",false]]" }],
  }),
  "group-flags": scenario({ title: "unique and crossInstance on any field of a group apply to the whole group", body: GROUP_FLAGS, printed: "{\"indexes\":{\"ab\":{\"fields\":[\"a\",\"b\"],\"unique\":true},\"cd\":{\"fields\":[\"c\",\"e\"],\"crossInstance\":true},\"ef\":{\"fields\":[\"f\",\"g\",\"h\"],\"crossInstance\":true},\"ij\":{\"fields\":[\"i\",\"j\"],\"unique\":true},\"plain\":{\"fields\":[\"k\",\"l\"]}},\"sameKey\":{\"name\":\"DuplicateKeyError\",\"message\":\"Duplicate key on index \\\"ab\\\" (a, b)\"},\"otherSecond\":1}" }),
  "field-types": scenario({ title: "Field hands every type to the database unchanged and combines with Index in either order", body: FIELD_TYPES, printed: "{\"names\":[\"id\",\"tags\",\"address\",\"total\",\"lateIndex\"],\"id\":\"string\",\"tags\":[\"string\"],\"address\":{\"street\":\"string\",\"geo\":{\"lat\":\"number\",\"lng\":\"number\"}},\"codecIsTheSameObject\":true,\"lateIndexType\":\"number\",\"indexes\":[\"total\",\"lateIndex\"]}" }),
  "relation-metadata": scenario({ title: "Relation records links without enforcing them", body: RELATION, printed: "{\"relationFields\":[\"authorId\",\"tagIds\"],\"authorTarget\":true,\"authorToField\":null,\"tagMany\":true,\"tagToField\":\"name\",\"dangling\":[\"nobody\",[\"ghost\"]],\"fieldsKept\":[\"authorId\",\"tagIds\",\"title\"],\"childRelations\":[\"authorId\",\"tagIds\",\"editorId\"],\"parentRelations\":[\"authorId\",\"tagIds\"]}" }),
  inheritance: scenario({ title: "a table subclass starts with a copy of its parent and never changes it", body: INHERITANCE, printed: "{\"late\":[true,true,\"crosses\"],\"built\":[{\"fields\":[\"a\",\"b\"],\"crossInstance\":true,\"unique\":true},{\"fields\":[\"a\",\"b\"],\"crossInstance\":true,\"unique\":true}],\"base\":{\"table\":\"people\",\"schema\":\"inh\",\"fields\":[\"createdAt\"],\"indexes\":[],\"unique\":[],\"cross\":[]},\"person\":{\"table\":\"people\",\"schema\":\"inh\",\"fields\":[\"createdAt\",\"email\"],\"indexes\":[\"email\"],\"unique\":[\"email\"],\"cross\":[]},\"employee\":{\"table\":\"people\",\"schema\":\"inh\",\"fields\":[\"createdAt\",\"email\",\"badge\"],\"indexes\":[\"email\",\"badge\"],\"unique\":[\"email\"],\"cross\":[]},\"contractor\":{\"table\":\"people\",\"schema\":\"inh\",\"fields\":[\"createdAt\",\"rate\"],\"indexes\":[],\"unique\":[],\"cross\":[]},\"cross\":{\"table\":\"crosses\",\"schema\":\"inh\",\"fields\":[\"a\",\"b\",\"c\"],\"indexes\":[\"ab\",\"c\"],\"unique\":[\"ab\"],\"cross\":[\"ab\"]},\"sub\":{\"table\":\"subs\",\"schema\":\"inh\",\"fields\":[\"a\",\"b\",\"c\",\"extra\"],\"indexes\":[\"ab\",\"c\"],\"unique\":[\"ab\"],\"cross\":[\"ab\"]}}" }),
  "combine-modifiers": scenario({ title: "Table.with combines the encryption, hashing and localization modifiers on one table", body: COMBINE, printed: "{\"stored\":[\"bio\",\"password\",\"privateInfo\"],\"privateInfo\":{\"address\":\"1 Main St\",\"phoneNumber\":\"555\"},\"password\":[true,false],\"bio\":[\"Bonjour\",\"Hello\"],\"mixins\":[\"function\",\"function\"]}" }),
  "table-with-subclass": scenario({ title: "X.with(...) returns a subclass of X that keeps X's fields and methods and gains the mixin's", body: WITH_SUBCLASS, printed: "{\"isUser\":[true,true,true],\"methods\":[\"hi Root\",\"function\",\"function\",\"function\",\"undefined\"],\"stored\":[\"hi Root\",true]}" }),
  "table-with-keeps-fields": scenario({
    title: "KNOWN FINDING AntelopeJS/interface-database-decorators#81, fails until fixed: the subclass X.with(...) returns keeps the fields and indexes decorated on X",
    body: WITH_FIELDS,
    printed: "{\"fields\":[\"email\",\"name\",\"password\"],\"built\":[\"email\",\"name\",\"password\"],\"indexes\":[\"email\"]}",
  }),
  "subclass-modifiers": scenario({ title: "a subclass's modifier and event lists never reach its parent", body: SUBCLASS_MODIFIERS, printed: "{\"parentModified\":[[],[]],\"childModified\":[[\"secret\"],[]],\"parentStored\":[[\"born\"],[]],\"childStored\":[[\"born\",\"extra\"],[\"secret\"]],\"parentFixture\":true,\"childSeesParentFields\":[\"name\",\"born\",\"extra\",\"secret\"]}" }),
  "table-with": scenario({ title: "Table.with adds the mixin methods of the modifiers to a subclass", body: WITH, printed: "{\"plainHasTestHash\":false,\"hashingHas\":[true,true,true,false],\"bothHas\":[true,true],\"isTableSubclass\":true,\"tableItselfUntouched\":\"undefined\",\"subIsASubclass\":true}" }),
} satisfies { [id: string]: Journey };
