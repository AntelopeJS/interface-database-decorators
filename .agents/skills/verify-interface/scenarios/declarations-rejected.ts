/** Statements that must each fail to compile: the journey passes only when tsc reports an error on every one of them, so a parameter type that gets looser stops being reported. */
export const REJECTED = [
  'void m.update({ name: "x" });',
  'void m.update("1");',
  'void m.update("1", { name: 5 });',
  'void m.update({ _id: 1, name: "x" });',
  'void m.update("1", { name: "x" }, { validate: "yes" });',
  'void m.insert({ name: 5 });',
  'void m.insert({ name: "x" }, { validate: 1 });',
  "void m.get(5);",
  "void m.delete(5);",
  'void m.getBy("nope", "x");',
  'void Model.validate({}, { partial: "yes" });',
  'void Model.fromPlainData({ name: 5 });',
  "void User.table(5);",
  "void Api.RegisterSchema(5);",
  "void Api.GetModel(Model, 5);",
  'void hashed.testHash("password", 5);',
  'void hashed.testHash("nope", "x");',
  'void hashed.testHashAsync("password", 5);',
  'void hashed.testHashAsync("nope", "x");',
  'void hashed.isHashOutdated("nope");',
  'void localized.localize("en", ["nope"]);',
  "void localized.localize(5);",
  'void Api.LocalizationModifier.fallbackLocaleOf(5, "name");',
  'Api.Index({ unique: "yes" });',
  "Api.Index({ group: 5 });",
  'Api.Index({ crossInstance: "yes" });',
  "Api.Relation({});",
  'Api.Relation({ to: () => User, many: "yes" });',
  'Api.Relation({ to: () => User, toField: 5 });',
  'Api.RegisterTable("only-a-name");',
  "Api.Encrypted({});",
  'Api.Encrypted({ secretKey: "k", ivSize: "16" });',
  "Api.Hashed({ algorithm: 5 });",
  "Api.Localized({ fallbackLocale: 5 });",
  "Api.Fixture(5);",
  "void Api.BasicDataModel(5);",
  "void Api.GetModel(5);",
  'Api.Index({ crossInstance: 1 });',
  'Api.RegisterTable(5, "schema");',
  'Api.RegisterTable("table", 5);',
  "Api.Encrypted({ secretKey: 5 });",
  'Api.Encrypted({ secretKey: "k", algorithm: 5 });',
  "Api.Relation({ to: User });",
  "Api.Relation({ to: () => Date });",
  "Api.Localized({ fallbackLocale: true });",
  "Api.Hashed({ algorithm: true });",
  "Api.Model(Model, 5);",
  'void Api.getMetadata(User, "key");',
];

export const REJECT_PRELUDE = `
class User extends Api.Table { declare name: string; }
const Model = Api.BasicDataModel(User, "users");
declare const m: InstanceType<typeof Model>;
class Hashed extends Api.Table.with(Api.HashModifier) { declare password: string; }
class Localized extends Api.Table.with(Api.LocalizationModifier) { declare name: string; }
declare const hashed: Hashed;
declare const localized: Localized;
`;
