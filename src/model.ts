import assert from "node:assert";
import type * as DatabaseDev from "@antelopejs/interface-database";
import type { SelectionKey } from "@antelopejs/interface-database/common";
import type { FieldType } from "@antelopejs/interface-database/schema";
import { type InstanceId, Schema } from "@antelopejs/interface-database";
import {
  type RequestContext,
  SetParameterProvider,
} from "@antelopejs/interface-api";
import {
  type Class,
  MakeParameterAndPropertyDecorator,
} from "@antelopejs/interface-core/decorators";

import {
  fromDatabase,
  fromPlainData,
  toDatabase,
  triggerEvent,
} from "./modifiers/common";
import { isRecord } from "./modifiers/internal/kinds";
import { boundSchema } from "./internal/bound-schema";
import {
  type Constructible,
  DatumStaticMetadata,
  type DeepPartial,
  getMetadata,
} from "./common";

export type DataModel<T = any> = {
  /**
   * Schema the table class registers into with `@RegisterTable`; `undefined`
   * for a table class that does not.
   */
  readonly schemaName: string | undefined;
  readonly tableClass?: Constructible;
  new (database: DatabaseDev.SchemaInstance<any>): {
    readonly database: DatabaseDev.SchemaInstance<any>;
    readonly table: DatabaseDev.Table<T>;
  };
  fromDatabase(obj: any): T | undefined;
  fromPlainData(obj: any): T;
};

export type FieldError = { field: string; message: string };
export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: FieldError[] };
export type ValidateInputOptions = { partial?: boolean };

type DecodeLeftLike = {
  _tag: "Left";
  left: Array<{ message?: string }>;
};
type DecodeRightLike = { _tag: "Right" };
type FieldCodec = Extract<FieldType, { decode: unknown }>;
type CodecLike = {
  decode(
    u: Parameters<FieldCodec["decode"]>[0],
  ): DecodeLeftLike | DecodeRightLike;
};

function isCodec(type: FieldType): type is CodecLike & FieldType {
  return (
    typeof type === "object" &&
    type !== null &&
    !Array.isArray(type) &&
    "decode" in type &&
    typeof type.decode === "function"
  );
}

/**
 * One key {@link BasicDataModel}'s `getBy` matches against an index: a value,
 * or a value proxy.
 */
export type IndexKey = DatabaseDev.ValueProxyOrValue<SelectionKey>;

type InstanceIdProvider = (ctx: RequestContext) => InstanceId | undefined;

function isInstanceIdProvider(
  value: InstanceId | InstanceIdProvider | undefined,
): value is InstanceIdProvider {
  return typeof value === "function";
}

function decodeFieldError(field: string, result: DecodeLeftLike): FieldError {
  const message =
    result.left.map((e) => e.message).find(Boolean) ?? `invalid ${field}`;
  return { field, message };
}

/**
 * Utility Class factory to create a basic Data Model with 1 table.
 *
 * @param dataType Database Table class
 * @param tableName Table name in Database
 */
export function BasicDataModel<T extends object>(
  dataType: Constructible<T>,
  tableName?: string,
) {
  const metadata = getMetadata(dataType, DatumStaticMetadata);
  const resolvedName = tableName ?? metadata.tableName;
  assert(resolvedName, "tableName must be provided or set via @RegisterTable");
  const name: string = resolvedName;
  const schemaName = metadata.schemaName;
  const primaryKey = metadata.primary;
  const toInstances = (dataR: T[]) =>
    // SAFETY: Model.fromDatabase returns undefined only for a falsy row, and the rows a table read or an index lookup returns are stored records, never null or undefined; the cast removes that undefined from the element type.
    dataR.map((row) => Model.fromDatabase(row)) as T[];
  const Model = class Model {
    public static readonly schemaName: string | undefined = schemaName;
    /**
     * Table class this model was built from.
     */
    public static readonly tableClass: Constructible<T> = dataType;
    /**
     * Converts some plain data into an instance of the Table class.
     *
     * @param obj Plain data object containing the table fields
     * @returns Table class instance
     */
    public static fromPlainData(obj: any) {
      return obj instanceof dataType ? obj : fromPlainData(obj, dataType);
    }

    /**
     * Converts an object acquired from the database into a Table class instance.
     *
     * @param obj Object resulting from a database get
     * @returns Table class instance
     */
    public static fromDatabase(obj: any) {
      return obj ? fromDatabase(obj, dataType) : undefined;
    }

    /**
     * Converts a Table class instance into an object fit to be inserted in the database.
     *
     * @param obj Table class instance
     * @returns Database-ready data
     */
    public static toDatabase(obj: any) {
      const instance = obj instanceof dataType ? obj : Model.fromPlainData(obj);
      return toDatabase(instance);
    }

    /**
     * Validates a plain object against every io-ts codec attached via `@Field`.
     * Pass `{ partial: true }` to skip fields not present on `obj` (patch semantics).
     */
    public static validate(
      obj: unknown,
      options?: ValidateInputOptions,
    ): ValidationResult {
      const fields = metadata.fields;
      const errors: FieldError[] = [];
      const partial = options?.partial === true;
      const record = isRecord(obj) ? obj : undefined;
      for (const [field, type] of Object.entries(fields)) {
        if (!isCodec(type)) continue;
        if (partial && (!record || !(field in record))) continue;
        const result = type.decode(record?.[field]);
        if (result._tag === "Left") {
          errors.push(decodeFieldError(field, result));
        }
      }
      return errors.length === 0 ? { ok: true } : { ok: false, errors };
    }

    /**
     * AQL Table reference.
     */
    public readonly table: DatabaseDev.Table<T>;

    constructor(public readonly database: DatabaseDev.SchemaInstance<any>) {
      this.table = database.table(name);
    }

    /**
     * Get a single element from the table using its primary key.
     *
     * @param id Primary key value
     * @returns Table class instance
     */
    public get(id: string) {
      return this.table.get(id).then((row) => Model.fromDatabase(row));
    }

    /**
     * Get multiple elements from the table using a given index.
     *
     * @param index Index name
     * @param keys Index value(s)
     * @returns Array of Table class instances.
     */
    public getBy(index: Extract<keyof T, string>, ...keys: IndexKey[]) {
      return this.table
        .getAll(keys.length === 1 ? keys[0] : keys, index)
        .then((dataR) => toInstances(dataR));
    }

    /**
     * Get all the elements from the table.
     *
     * @returns Array of Table class instances.
     */
    public getAll() {
      return this.table.then((dataR) => toInstances(dataR));
    }

    /**
     * Insert some data into the table.
     *
     * @param obj Table class instance or plain data
     * @param options Insert options
     * @returns Insert result
     */
    public async insert(
      obj: DeepPartial<T> | Array<DeepPartial<T>>,
      options?: ValidateOptions,
    ) {
      if (options?.validate) {
        const entries = Array.isArray(obj) ? obj : [obj];
        const allErrors: FieldError[] = [];
        for (const entry of entries) {
          const result = Model.validate(entry);
          if (!result.ok) allErrors.push(...result.errors);
        }
        if (allErrors.length > 0) throw makeValidationError(allErrors);
      }
      const converter = (entry: any) => {
        const instance = Model.fromPlainData(entry);
        triggerEvent(instance, "insert");
        return Model.toDatabase(instance);
      };
      return this.table
        .insert(Array.isArray(obj) ? obj.map(converter) : converter(obj))
        .run();
    }

    /**
     * Updates a single element in the table.
     *
     * @param id Primary key value
     * @param obj Table class instance or plain data
     * @param options Update options
     * @returns Update result
     */
    public update(
      id: string,
      obj: DeepPartial<T>,
      options?: ValidateOptions,
    ): Promise<number>;
    public update(
      obj: DeepPartial<T>,
      options?: ValidateOptions,
    ): Promise<number>;
    public async update(...args: UpdateArgs<T>) {
      const parsed = parseUpdateArgs(args);
      if (parsed.options?.validate) {
        const result = Model.validate(parsed.data, { partial: true });
        if (!result.ok) throw makeValidationError(result.errors);
      }
      if (parsed.id !== undefined) {
        const instance = Model.fromPlainData(parsed.data);
        triggerEvent(instance, "update");
        return this.table
          .get(parsed.id)
          .update(Model.toDatabase(instance))
          .run();
      }
      const instance = Model.fromPlainData(parsed.data);
      triggerEvent(instance, "update");
      // SAFETY: parsed.data is the DeepPartial<T> object the caller passed as the first argument (the id form was handled above), so reading the property named by the table's primary key is defined and gives undefined when absent; the next line asserts it is present.
      const id = (parsed.data as any)[primaryKey];
      assert(id !== undefined, "Missing primary key in object update.");
      return this.table.get(id).update(Model.toDatabase(instance)).run();
    }

    /**
     * Delete an element from the table.
     *
     * @param id Primary key value
     * @returns Delete result
     */
    public delete(id: string) {
      return this.table.get(id).delete().run();
    }
  };
  return Model;
}

const modelCache = new Map<
  Class,
  Map<string | symbol, InstanceType<DataModel>>
>();

const UNDEFINED_INSTANCE_KEY = Symbol("undefined-instance");

function cacheKeyOf(instanceId: InstanceId | undefined): string | symbol {
  if (instanceId === undefined) return UNDEFINED_INSTANCE_KEY;
  return instanceId;
}

export type ValidateOptions = { validate?: boolean };

type ParsedUpdate<T> = {
  id?: string;
  data: DeepPartial<T>;
  options?: ValidateOptions;
};

function makeValidationError(errors: FieldError[]): Error {
  const summary = errors.map((e) => `${e.field} (${e.message})`).join(", ");
  return Object.assign(new Error(`validation failed: ${summary}`), { errors });
}

type IdUpdateArgs<T> = [
  id: string,
  data: DeepPartial<T>,
  options?: ValidateOptions,
];
type ObjectUpdateArgs<T> = [data: DeepPartial<T>, options?: ValidateOptions];
type UpdateArgs<T> = IdUpdateArgs<T> | ObjectUpdateArgs<T>;

function isIdUpdate<T>(args: UpdateArgs<T>): args is IdUpdateArgs<T> {
  return typeof args[0] === "string";
}

function parseUpdateArgs<T>(args: UpdateArgs<T>): ParsedUpdate<T> {
  if (isIdUpdate(args)) {
    const [id, data, options] = args;
    return { id, data, options };
  }
  const [data, options] = args;
  return { data, options };
}

function schemaOf(cl: DataModel): Schema<any> {
  if (!cl.tableClass) {
    const schema =
      cl.schemaName === undefined ? undefined : Schema.get(cl.schemaName);
    assert(schema, `Schema not found for '${cl.schemaName}'`);
    return schema;
  }
  const schema = boundSchema(getMetadata(cl.tableClass, DatumStaticMetadata));
  assert(
    schema,
    `${cl.tableClass.name} is not bound to a schema: call RegisterSchema("${cl.schemaName}") in the module that declares it`,
  );
  return schema;
}

export function GetModel<M extends InstanceType<DataModel>>(
  cl: DataModel & Class<M>,
  instanceId?: InstanceId,
) {
  if (!modelCache.has(cl)) {
    modelCache.set(cl, new Map());
  }
  const cache = modelCache.get(cl);
  assert(cache);
  const key = cacheKeyOf(instanceId);
  const cached = cache.get(key);
  if (cached) {
    // SAFETY: modelCache is private to this module, keyed by the class, and only this function fills it, with the `new cl(...)` result below, which is an M for that same cl.
    return cached as M;
  }
  const model = new cl(schemaOf(cl).instance(instanceId));
  cache.set(key, model);
  return model;
}

export const Model = MakeParameterAndPropertyDecorator(
  (
    target,
    key,
    index,
    cl: DataModel & Class<InstanceType<DataModel>>,
    instanceIdOrCallback?:
      | InstanceId
      | ((ctx: RequestContext) => InstanceId | undefined),
  ) => {
    if (isInstanceIdProvider(instanceIdOrCallback)) {
      SetParameterProvider(target, key, index, (ctx: RequestContext) => {
        return GetModel(cl, instanceIdOrCallback(ctx));
      });
    } else {
      SetParameterProvider(target, key, index, () =>
        GetModel(cl, instanceIdOrCallback),
      );
    }
  },
);
