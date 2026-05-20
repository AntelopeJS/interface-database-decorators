import assert from "node:assert";
import {
  type RequestContext,
  SetParameterProvider,
} from "@antelopejs/interface-api";
import {
  type Class,
  MakeParameterAndPropertyDecorator,
} from "@antelopejs/interface-core/decorators";
import type * as DatabaseDev from "@antelopejs/interface-database";
import { type InstanceId, Schema } from "@antelopejs/interface-database";
import type { FieldType } from "@antelopejs/interface-database/schema";
import {
  type Constructible,
  DatumStaticMetadata,
  type DeepPartial,
  getMetadata,
} from "./common";
import {
  fromDatabase,
  fromPlainData,
  toDatabase,
  triggerEvent,
} from "./modifiers/common";

export type DataModel<T = any> = {
  readonly schemaName: string;
  new (
    database: DatabaseDev.SchemaInstance<any>,
  ): {
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

type DecodeLeftLike = {
  _tag: "Left";
  left: Array<{ message?: string }>;
};
type DecodeRightLike = { _tag: "Right" };
type CodecLike = {
  decode(u: unknown): DecodeLeftLike | DecodeRightLike;
};

function isCodec(type: FieldType): type is FieldType & CodecLike {
  return (
    typeof type === "object" &&
    type !== null &&
    !Array.isArray(type) &&
    typeof (type as { decode?: unknown }).decode === "function"
  );
}

function decodeFieldError(field: string, result: DecodeLeftLike): FieldError {
  const message = result.left[0]?.message ?? `invalid ${field}`;
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
  return class Model {
    public static readonly schemaName = schemaName as string;
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
     */
    public static validate(obj: unknown): ValidationResult {
      const fields = metadata.fields;
      const errors: FieldError[] = [];
      for (const [field, type] of Object.entries(fields)) {
        if (!isCodec(type)) continue;
        const value = (obj as Record<string, unknown> | null | undefined)?.[
          field
        ];
        const result = (type as CodecLike).decode(value);
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
      return this.table.get(id).then(Model.fromDatabase);
    }

    /**
     * Get multiple elements from the table using a given index.
     *
     * @param index Index name
     * @param keys Index value(s)
     * @returns Array of Table class instances.
     */
    public getBy(index: keyof T, ...keys: any[]) {
      return this.table
        .getAll(keys.length === 1 ? keys[0] : keys, <string>index)
        .then((dataR) => dataR.map(Model.fromDatabase) as T[]);
    }

    /**
     * Get all the elements from the table.
     *
     * @returns Array of Table class instances.
     */
    public getAll() {
      return this.table.then((dataR) => dataR.map(Model.fromDatabase) as T[]);
    }

    /**
     * Insert some data into the table.
     *
     * @param obj Table class instance or plain data
     * @param options Insert options
     * @returns Insert result
     */
    public insert(
      obj: DeepPartial<T> | Array<DeepPartial<T>>,
      options?: ValidateOptions,
    ) {
      if (options?.validate) {
        const entries = Array.isArray(obj) ? obj : [obj];
        for (const entry of entries) {
          const result = Model.validate(entry);
          if (!result.ok) throw makeValidationError(result.errors);
        }
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
    public update(
      idOrObj: DeepPartial<T> | string,
      objOrOptions?: DeepPartial<T> | ValidateOptions,
      options?: ValidateOptions,
    ) {
      const parsed = parseUpdateArgs<T>(idOrObj, objOrOptions, options);
      if (parsed.options?.validate) {
        const result = Model.validate(parsed.data);
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
}

const modelCache = new Map<
  Class,
  Map<string | symbol, InstanceType<DataModel>>
>();

const UNDEFINED_INSTANCE_KEY = Symbol("undefined-instance");

function cacheKeyOf(instanceId: InstanceId | undefined): string | symbol {
  if (instanceId === undefined) return UNDEFINED_INSTANCE_KEY;
  if (typeof instanceId === "symbol") return instanceId;
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
  const err = new Error(`validation failed: ${summary}`) as Error & {
    errors: FieldError[];
  };
  err.errors = errors;
  return err;
}

function parseUpdateArgs<T>(
  idOrObj: DeepPartial<T> | string,
  objOrOptions?: DeepPartial<T> | ValidateOptions,
  options?: ValidateOptions,
): ParsedUpdate<T> {
  if (typeof idOrObj === "string") {
    return {
      id: idOrObj,
      data: objOrOptions as DeepPartial<T>,
      options,
    };
  }
  return {
    data: idOrObj,
    options: objOrOptions as ValidateOptions | undefined,
  };
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
  if (cached) return cached as M;
  const schema = Schema.get(cl.schemaName);
  assert(schema, `Schema not found for '${cl.schemaName}'`);
  const model = new cl(schema.instance(instanceId));
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
    if (typeof instanceIdOrCallback === "function") {
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
