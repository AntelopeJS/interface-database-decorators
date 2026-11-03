import type { Journey } from "@antelopejs/tooling-configs/verify";

/** The probe header: `Assert<Identical<A, B>>` fails to compile unless A and B are the same type. */
const PROBE_HEADER = `
type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
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
type _Fallback = Assert<Identical<ReturnType<typeof Api.LocalizationModifier.fallbackLocaleOf>, string | undefined>>;
`;

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
  "modifier-signatures": declared("the hash and localization mixins declare the return types the docs describe", MODIFIER_SIGNATURES),
} satisfies { [id: string]: Journey };
