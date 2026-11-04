import type { Journey } from "@antelopejs/tooling-configs/verify";

/** The probe header: `Assert<Identical<A, B>>` fails to compile unless A and B are the same type. */
const PROBE_HEADER = `
type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type CanCall<F, Args extends unknown[]> = F extends (...args: Args) => unknown ? true : false;
`;

const MODEL_SIGNATURES = `
class User extends Api.Table { declare name: string; }
const Model = Api.BasicDataModel(User, "users");
type Instance = InstanceType<typeof Model>;
type _Get = Assert<Identical<ReturnType<Instance["get"]>, PromiseLike<User | undefined>>>;
type _GetBy = Assert<Identical<ReturnType<Instance["getBy"]>, PromiseLike<User[]>>>;
type _GetAll = Assert<Identical<ReturnType<Instance["getAll"]>, PromiseLike<User[]>>>;
type _Insert = Assert<Identical<ReturnType<Instance["insert"]>, Promise<string[]>>>;
type _Delete = Assert<Identical<ReturnType<Instance["delete"]>, Promise<number>>>;
type _Update = Assert<Identical<Awaited<ReturnType<Instance["update"]>>, number>>;
type _FromDatabase = Assert<Identical<ReturnType<typeof Model.fromDatabase>, User | undefined>>;
type _ToDatabase = Assert<Identical<ReturnType<typeof Model.toDatabase>, Api.StoredRow<User>>>;
type _Validate = Assert<Identical<ReturnType<typeof Model.validate>, Api.ValidationResult>>;
type _Register = Assert<Identical<typeof Api.RegisterSchema, (schemaId: string) => Promise<void>>>;
type _Fixture = Assert<Identical<Api.DatumGeneratorOutput<{ a: 1 }>, { a: 1 } | { a: 1 }[] | undefined>>;
type _PrimaryKey = Assert<Identical<User["_id"], string>>;
type _UpdateById = Assert<CanCall<Instance["update"], [string, { name: string }]>>;
type _UpdateByIdOptions = Assert<CanCall<Instance["update"], [string, { name: string }, { validate: boolean }]>>;
type _UpdateByObject = Assert<CanCall<Instance["update"], [{ _id: string; name: string }]>>;
type _UpdateByObjectOptions = Assert<CanCall<Instance["update"], [{ _id: string; name: string }, { validate: true }]>>;
type _UpdateNoKey = Assert<Identical<CanCall<Instance["update"], [{ name: string }]>, false>>;
type _UpdateNoData = Assert<Identical<CanCall<Instance["update"], [string]>, false>>;
type _UpdateBadId = Assert<Identical<CanCall<Instance["update"], [{ _id: number; name: string }]>, false>>;
type _UpdateBadField = Assert<Identical<CanCall<Instance["update"], [string, { name: number }]>, false>>;
type _UpdateBadOptions = Assert<Identical<CanCall<Instance["update"], [string, { name: string }, { validate: string }]>, false>>;
type _GetParams = Assert<Identical<Parameters<Instance["get"]>, [id: string]>>;
type _DeleteParams = Assert<Identical<Parameters<Instance["delete"]>, [id: string]>>;
type _InsertOptions = Assert<Identical<Parameters<Instance["insert"]>[1], Api.ValidateOptions | undefined>>;
type _ValidateParams = Assert<Identical<Parameters<typeof Model.validate>, [obj: unknown, options?: Api.ValidateInputOptions]>>;
type _ValidateOptions = Assert<Identical<Api.ValidateInputOptions, { partial?: boolean }>>;
type _GetModelInstance = Assert<Identical<Parameters<typeof Api.GetModel>[1], Parameters<typeof User.table>[0] extends infer T ? Extract<T, string | symbol | undefined> : never>>;
type _Table = Assert<Identical<Parameters<typeof User.table>[0], Api.TableTarget | undefined>>;
`;

const MODIFIER_SIGNATURES = `
class Hashed extends Api.Table.with(Api.HashModifier) { declare password: string; }
class Localized extends Api.Table.with(Api.LocalizationModifier) { declare name: string; }
declare const hashed: Hashed;
const tested = hashed.testHash("password", "x");
const testedAsync = hashed.testHashAsync("password", "x");
const outdated = hashed.isHashOutdated("password");
type _TestHash = Assert<Identical<typeof tested, unknown>>;
type _TestHashAsync = Assert<Identical<typeof testedAsync, Promise<boolean>>>;
type _Outdated = Assert<Identical<typeof outdated, boolean>>;
declare const localized: Localized;
const switched = localized.localize("en");
type _Localize = Assert<Identical<typeof switched, Localized>>;
const testedNumber = hashed.testHash("password", "x");
const accepted = [hashed.testHashAsync("password", "x"), localized.localize("en", ["name"]), localized.localize("fr", [])];
type _FallbackParams = Assert<Identical<Parameters<typeof Api.LocalizationModifier.fallbackLocaleOf>, [TableClass: Api.Constructible, field: string]>>;
type _Fallback = Assert<Identical<ReturnType<typeof Api.LocalizationModifier.fallbackLocaleOf>, string | undefined>>;
`;

/** Statements that must each fail to compile: the journey passes only when tsc reports an error on every one of them, so a parameter type that gets looser stops being reported. */
const REJECTED = [
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
];

const REJECT_PRELUDE = `
class User extends Api.Table { declare name: string; }
const Model = Api.BasicDataModel(User, "users");
declare const m: InstanceType<typeof Model>;
class Hashed extends Api.Table.with(Api.HashModifier) { declare password: string; }
class Localized extends Api.Table.with(Api.LocalizationModifier) { declare name: string; }
declare const hashed: Hashed;
declare const localized: Localized;
`;

function rejected(title: string, statements: string[]): Journey {
  return {
    title,
    entryPoint: "a TypeScript consumer compiling wrong calls against the packed declarations",
    async run(context) {
      const file = `${context.work}/reject.ts`;
      const head = `import * as Api from "${context.repo}/dist/index";\n${PROBE_HEADER}\n${REJECT_PRELUDE}`;
      const firstLine = head.split("\n").length + 1;
      context.edit("write the rejecting probe", file, `${head}\n${statements.join("\n")}\n`);
      const compiled = await context.command("compile the rejecting probe", "node", [
        `${context.repo}/node_modules/typescript/bin/tsc`,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--experimentalDecorators",
        "--target",
        "es2022",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--typeRoots",
        `${context.repo}/node_modules/@types`,
        "--types",
        "node",
        file,
      ]);
      const failing = new Set([...compiled.stdout.matchAll(/reject\.ts\((\d+),/g)].map((match) => Number(match[1])));
      const accepted = statements.filter((_, index) => !failing.has(firstLine + index));
      context.expect(compiled.folder, [
        { name: "tsc refuses every wrong call", pass: accepted.length === 0, detail: accepted.join(" | ") },
      ]);
    },
  };
}

function declared(title: string, probe: string): Journey {
  return {
    title,
    entryPoint: "a TypeScript consumer compiling against the packed declarations",
    async run(context) {
      const file = `${context.work}/probe.ts`;
      context.edit("write the signature probe", file, `import * as Api from "${context.repo}/dist/index";\n${PROBE_HEADER}\n${probe}`);
      const compiled = await context.command("compile the signature probe", "node", [
        `${context.repo}/node_modules/typescript/bin/tsc`,
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--experimentalDecorators",
        "--target",
        "es2022",
        "--module",
        "commonjs",
        "--moduleResolution",
        "node",
        "--typeRoots",
        `${context.repo}/node_modules/@types`,
        "--types",
        "node",
        file,
      ]);
      context.expect(compiled.folder, [
        { name: "every export has the documented signature", pass: compiled.exitCode === 0, detail: compiled.stdout.slice(0, 600) },
      ]);
    },
  };
}

export const DECLARATION_JOURNEYS = {
  "model-signatures": declared("the model methods and RegisterSchema declare the return types the docs table lists", MODEL_SIGNATURES),
  "rejected-calls": rejected("calls with a wrong parameter type or a missing key are refused by the declarations", REJECTED),
  "modifier-signatures": declared("the hash and localization mixins declare the return types the docs describe", MODIFIER_SIGNATURES),
} satisfies { [id: string]: Journey };
