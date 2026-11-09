/** The probe header: `Assert<Identical<A, B>>` fails to compile unless A and B are the same type. */
export const PROBE_HEADER = `
type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type CanCall<F, Args extends unknown[]> = F extends (...args: Args) => unknown ? true : false;
`;

export const MODEL_SIGNATURES = `
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
type _ModelWithoutInstance = Assert<CanCall<typeof Api.Model, [typeof Model]>>;
Api.Fixture(async () => [{ _id: "a" }])(User);
Api.Fixture(async () => ({ _id: "b" }))(User);
class Greeter extends Api.Table { declare name: string; greet(): string { return this.name; } }
const GreeterModel = Api.BasicDataModel(Greeter, "greeters");
const greeterRow = GreeterModel.toDatabase({ name: "plain data" });
type _ToDatabasePlain = Assert<Identical<typeof greeterRow, Api.StoredRow<Greeter>>>;
class Admin extends Greeter.with(Api.HashModifier) {}
type _WithKeepsFields = Assert<Identical<Admin["name"], string>>;
type _WithKeepsMethods = Assert<Identical<ReturnType<Admin["greet"]>, string>>;
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
class Custom {
  static readonly schemaName = "manual";
  readonly table: Db.Table<object>;
  constructor(readonly database: Db.SchemaInstance<any>) {
    this.table = database.table("things");
  }
  static fromDatabase(obj: any): object | undefined {
    return obj ? obj : undefined;
  }
  static fromPlainData(obj: object): object {
    return obj;
  }
}
const custom = Api.GetModel(Custom);
type _CustomModel = Assert<Identical<typeof custom, Custom>>;
`;

export const MODIFIER_SIGNATURES = `
class Hashed extends Api.Table.with(Api.HashModifier) { declare password: string; }
class Localized extends Api.Table.with(Api.LocalizationModifier) { declare name: string; }
declare const hashed: Hashed;
const tested = hashed.testHash("password", "x");
const testedAsync = hashed.testHashAsync("password", "x");
const outdated = hashed.isHashOutdated("password");
type _TestHash = Assert<Identical<typeof tested, boolean>>;
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
