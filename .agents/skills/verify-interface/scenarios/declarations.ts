import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import { equal } from "@antelopejs/tooling-configs/verify";
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
type _GetByNumberKey = Assert<CanCall<Instance["getBy"], ["name", number]>>;
type _GetByBooleanKey = Assert<CanCall<Instance["getBy"], ["name", boolean]>>;
type _GetByCompoundKeys = Assert<CanCall<Instance["getBy"], ["name", string, number, boolean]>>;
type _GetByProxyKey = Assert<CanCall<Instance["getBy"], ["name", Db.ValueProxy<string | number | boolean>]>>;
type _IndexKeyIsGetAllKey = Assert<Identical<Api.IndexKey, Exclude<Parameters<Db.Table<object>["getAll"]>[0], unknown[]>>>;
type _Insert = Assert<Identical<ReturnType<Instance["insert"]>, Promise<string[]>>>;
type _Delete = Assert<Identical<ReturnType<Instance["delete"]>, Promise<number>>>;
type _Update = Assert<Identical<Awaited<ReturnType<Instance["update"]>>, number>>;
type _FromDatabase = Assert<Identical<ReturnType<typeof Model.fromDatabase>, User | undefined>>;
type _ToDatabase = Assert<Identical<ReturnType<typeof Model.toDatabase>, Api.StoredRow<User>>>;
type _Validate = Assert<Identical<ReturnType<typeof Model.validate>, Api.ValidationResult>>;
type _ValidationResultShape = Assert<Identical<Api.ValidationResult, { ok: true } | { ok: false; errors: { field: string; message: string }[] }>>;
type _PlainRowShape = Assert<Identical<Api.PlainRow<User>, { _id?: string; name?: string }>>;
type _StoredRowField = Assert<Identical<Api.StoredRow<User>["name"], string | undefined>>;
type _StoredRowId = Assert<Identical<Api.StoredRow<User>["_id"], string | undefined>>;
type _StoredRowInternal = Assert<Identical<"_internal" extends keyof Api.StoredRow<User> ? true : false, true>>;
type _StoredRowLocked = Assert<Identical<keyof NonNullable<Api.StoredRow<User>["_internal"]>, "meta" | "data">>;
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
declare const u: User;
const plain = Api.toPlainData(u);
type _ToPlain = Assert<Identical<typeof plain, Api.PlainRow<User>>>;
const modified = Api.getModifiedFields(u, Api.HashModifier);
type _Modified = Assert<Identical<typeof modified, (keyof User)[]>>;
type _Tables = Assert<Identical<InstanceType<NonNullable<ReturnType<typeof Api.getTablesForSchema>>[string]>, Api.Table>>;
type _TablesMaybe = Assert<Identical<undefined extends ReturnType<typeof Api.getTablesForSchema> ? true : false, true>>;
const meta = Api.getMetadata(User, Api.DatumStaticMetadata);
type _Meta = Assert<Identical<typeof meta, Api.DatumStaticMetadata>>;
const built = Api.fromPlainData({ name: "x" }, User);
type _FromPlain = Assert<Identical<typeof built, User>>;
const read = Api.fromDatabase({ name: "x" }, User);
type _FromDb = Assert<Identical<typeof read, User>>;
const stored = Api.toDatabase(u);
type _ToDb = Assert<Identical<typeof stored extends User ? true : false, true>>;
class Options extends Api.Table.with(Api.EncryptionModifier, Api.HashModifier, Api.LocalizationModifier) {
  @Api.Index({ group: "g", crossInstance: true, unique: true }) @Api.Field("string") declare a: string;
  @Api.Relation({ to: () => User, toField: "name", many: true }) @Api.Field("string") declare b: string;
  @Api.Encrypted({ secretKey: "k", algorithm: "aes-256-gcm", ivSize: 16 }) @Api.Field("string") declare c: string;
  @Api.Hashed({ algorithm: "sha256" }) @Api.Field("string") declare d: string;
  @Api.Localized({ fallbackLocale: "en" }) @Api.Field("string") declare e: string;
}
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
  'Api.Index({ crossInstance: 1 });',
  'Api.RegisterTable(5, "schema");',
  'Api.RegisterTable("table", 5);',
  "Api.Encrypted({ secretKey: 5 });",
  'Api.Encrypted({ secretKey: "k", algorithm: 5 });',
  "Api.Relation({ to: User });",
  "Api.Localized({ fallbackLocale: true });",
  "Api.Hashed({ algorithm: true });",
  "Api.Model(Model, 5);",
  'void Api.getMetadata(User, "key");',
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
      context.edit("write the signature probe", file, `import * as Api from "${context.repo}/dist/index";\nimport type * as Db from "${context.repo}/node_modules/@antelopejs/interface-database";\n${PROBE_HEADER}\n${probe}`);
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

const PACKED_CHECK = `
const fs = require("node:fs");
const path = require("node:path");
const pack = process.argv[2];
const consumer = process.argv[3];
const skill = fs.readFileSync(path.join(pack, "skills", "database-decorators-interface", "SKILL.md"), "utf8");
const name = "@antelopejs/interface-database-decorators";
const result = { files: ["docs/1.introduction.md", "docs/5.parameter-decoration.md", "skills/database-decorators-interface/SKILL.md", "dist/index.js"].filter((file) => !fs.existsSync(path.join(pack, file))), imports: {} };
const wanted = new Map();
for (const match of skill.matchAll(/import \\{([^}]*)\\} from "(@antelopejs\\/interface-database-decorators[^"]*)"/g)) {
  const names = match[1].split(",").map((entry) => entry.trim()).filter(Boolean);
  wanted.set(match[2], [...(wanted.get(match[2]) ?? []), ...names]);
}
const requireFrom = require("node:module").createRequire(path.join(consumer, "index.js"));
for (const [specifier, names] of wanted) {
  try {
    const loaded = requireFrom(specifier);
    result.imports[specifier] = names.filter((entry) => loaded[entry] === undefined);
  } catch (error) {
    result.imports[specifier] = "ERR " + error.code;
  }
}
console.log("RESULT " + JSON.stringify({ subpaths: [...wanted.keys()].sort(), files: result.files, imports: result.imports }));
`;

/** The folder `new` packed and extracted: the nearest ancestor of the journey folder that holds `pack/package`. */
function packedPackage(work: string): string {
  let folder = work;
  while (!existsSync(join(folder, "pack", "package", "package.json"))) {
    const parent = dirname(folder);
    if (parent === folder) throw new Error(`no packed package above ${work}`);
    folder = parent;
  }
  return join(folder, "pack", "package");
}

const packedSubpaths: Journey = {
  title: "the packed package ships its docs and skill, and every subpath its skill file imports from exports the names the skill shows",
  entryPoint: "a consumer resolving the packed tarball's exports, as npm would publish them",
  async run(context) {
    const pack = packedPackage(context.work);
    const consumer = join(context.work, "consumer");
    const scope = join(consumer, "node_modules", "@antelopejs");
    mkdirSync(scope, { recursive: true });
    symlinkSync(pack, join(scope, "interface-database-decorators"), "dir");
    if (!existsSync(join(pack, "node_modules"))) symlinkSync(join(context.repo, "node_modules"), join(pack, "node_modules"), "dir");
    const script = join(context.work, "packed-check.cjs");
    context.edit("write the packed check", script, PACKED_CHECK);
    const ran = await context.command("load every subpath of the skill's imports", "node", [script, pack, consumer]);
    const line = ran.stdout.split("\n").find((entry) => entry.startsWith("RESULT "));
    context.expect(ran.folder, [
      { name: "the check ended cleanly", pass: ran.exitCode === 0, detail: ran.stderr.slice(-300) },
      equal("the packed package carries what the skill imports", line?.slice("RESULT ".length) ?? "", "{\"subpaths\":[\"@antelopejs/interface-database-decorators/common\",\"@antelopejs/interface-database-decorators/database\",\"@antelopejs/interface-database-decorators/model\",\"@antelopejs/interface-database-decorators/modifiers/autodate\",\"@antelopejs/interface-database-decorators/modifiers/common\",\"@antelopejs/interface-database-decorators/modifiers/encryption\",\"@antelopejs/interface-database-decorators/modifiers/hash\",\"@antelopejs/interface-database-decorators/modifiers/localization\",\"@antelopejs/interface-database-decorators/relation\",\"@antelopejs/interface-database-decorators/schema\",\"@antelopejs/interface-database-decorators/table\"],\"files\":[],\"imports\":{\"@antelopejs/interface-database-decorators/table\":[],\"@antelopejs/interface-database-decorators/schema\":[],\"@antelopejs/interface-database-decorators/database\":[],\"@antelopejs/interface-database-decorators/model\":[],\"@antelopejs/interface-database-decorators/relation\":[],\"@antelopejs/interface-database-decorators/common\":[],\"@antelopejs/interface-database-decorators/modifiers/autodate\":[],\"@antelopejs/interface-database-decorators/modifiers/encryption\":[],\"@antelopejs/interface-database-decorators/modifiers/hash\":[],\"@antelopejs/interface-database-decorators/modifiers/localization\":[],\"@antelopejs/interface-database-decorators/modifiers/common\":[]}}"),
    ]);
  },
};

export const DECLARATION_JOURNEYS = {
  "model-signatures": declared("the model methods and RegisterSchema declare the return types the docs table lists", MODEL_SIGNATURES),
  "packed-subpaths": packedSubpaths,
  "rejected-calls": rejected("calls with a wrong parameter type or a missing key are refused by the declarations", REJECTED),
  "modifier-signatures": declared("the hash and localization mixins declare the return types the docs describe", MODIFIER_SIGNATURES),
} satisfies { [id: string]: Journey };
