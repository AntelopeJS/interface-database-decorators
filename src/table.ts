import assert from "node:assert";
import type {
  InstanceId,
  Table as QueryTable,
  SchemaInstance,
} from "@antelopejs/interface-database";
import type { FieldType } from "@antelopejs/interface-database/schema";
import {
  type ClassDecorator,
  MakeClassDecorator,
  MakePropertyDecorator,
} from "@antelopejs/interface-core/decorators";

import { MixinSymbol, type MixinType } from "./modifiers/common";
import { type Constructible, DatumStaticMetadata, getMetadata } from "./common";

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export const TableMetaSymbol = Symbol();
export const TableRefSymbol = Symbol();
export type ExtractTableMeta<T> = T extends { [TableMetaSymbol]: infer Meta }
  ? Meta extends object
    ? Meta
    : never
  : object;

export interface TableClass<
  Base = object,
  Args extends any[] = [],
  Meta extends object | undefined = undefined,
> {
  new (
    ...args: Args
  ): { _id: string } & Base &
    (Meta extends object ? { [TableMetaSymbol]: Meta } : object);

  with<
    This extends TableClass,
    T extends Constructible<{ [MixinSymbol]: Constructible }>[] = [],
  >(
    this: This,
    ...other: T
  ): TableClass<
    InstanceType<This> &
      UnionToIntersection<InstanceType<MixinType<InstanceType<T[number]>>>>,
    ConstructorParameters<This>,
    | ExtractTableMeta<InstanceType<This>>
    | ExtractTableMeta<InstanceType<T[number]>>
  >;

  table<This extends TableClass>(
    this: This,
    target?: TableTarget,
  ): QueryTable<InstanceType<This>>;
}

/**
 * Where {@link Table.table} opens the table: an instance id of the schema
 * the class is bound to, or a schema instance to take the table from.
 */
export type TableTarget = InstanceId | SchemaInstance<any>;

function isSchemaInstance(
  target: TableTarget | undefined,
): target is SchemaInstance<any> {
  return typeof target === "object" && target !== null;
}

/**
 * Database Table superclass
 */
export class Table {
  declare _id: string;

  /**
   * Gets the AQL table this class describes.
   *
   * The class must be decorated with `@RegisterTable` and bound to its schema
   * by `RegisterSchema`, which the declaring module calls.
   *
   * @param target Instance id of the bound schema (default instance when
   * omitted), or a schema instance to take the table from
   * @returns AQL Table
   */
  public static table<This extends typeof Table>(
    this: This,
    target?: TableTarget,
  ): QueryTable<InstanceType<This>> {
    const metadata = getMetadata(this, DatumStaticMetadata);
    const tableName = metadata.tableName;
    assert(
      tableName,
      `${this.name} has no table name: decorate it with @RegisterTable`,
    );
    if (isSchemaInstance(target)) {
      return target.table(tableName);
    }
    assert(
      metadata.schema,
      `${this.name} is not bound to a schema: call RegisterSchema("${metadata.schemaName}") in the module that declares it`,
    );
    return metadata.schema.instance(target).table(tableName);
  }

  /**
   * Supplement the superclass with Modifier mixins.
   *
   * @param others List of Modifier mixin classes
   * @returns New superclass
   */
  public static with<
    This extends typeof Table,
    T extends Constructible<{ [MixinSymbol]: Constructible }>[] = [],
  >(
    this: This,
    ...others: T
  ): TableClass<
    InstanceType<This> &
      UnionToIntersection<InstanceType<MixinType<InstanceType<T[number]>>>>,
    ConstructorParameters<This>,
    | ExtractTableMeta<InstanceType<This>>
    | ExtractTableMeta<InstanceType<T[number]>>
  > {
    const c = class _internal_table extends (this as any) {};
    for (const mixin of others
      .map((otherClass) => otherClass.prototype && new otherClass())
      .map((other) => other?.[MixinSymbol])
      .filter((mixin) => mixin?.prototype)) {
      for (const key of Object.getOwnPropertyNames(mixin.prototype)) {
        if (key !== "constructor" && !(key in c.prototype)) {
          (<any>c.prototype)[key] = mixin.prototype[key];
        }
      }
      for (const key of Object.getOwnPropertySymbols(mixin.prototype)) {
        if (!(key in c.prototype)) {
          (<any>c.prototype)[key] = mixin.prototype[key];
        }
      }
    }
    return <any>c;
  }
}

/**
 * Options of the {@link Index} decorator.
 */
export interface IndexOptions {
  /**
   * Index name for multi-field indexes.
   */
  group?: string;
  /**
   * Also keep this index fast for queries that run across all instances.
   *
   * Every index is always scoped to the instance; set this when the index is
   * also queried across instances. It never changes query results.
   * For a group, setting it on any field applies it to the whole group.
   */
  crossInstance?: boolean;
  /**
   * Refuse a second row of the instance with the same key: the write throws
   * `DuplicateKeyError` from `@antelopejs/interface-database`.
   *
   * For a group, setting it on any field makes the whole group's key unique.
   */
  unique?: boolean;
}

/**
 * Database Table Index decorator.
 *
 * Available options:
 * - `group`: Index name for multi-field indexes.
 * - `crossInstance`: Also keep the index fast for cross-instance queries.
 * - `unique`: Refuse two rows of the instance with the same key.
 *
 * @param options Options
 */
export const Index = MakePropertyDecorator(
  (target, propertyKey, options?: IndexOptions) => {
    const metadata = getMetadata(target.constructor, DatumStaticMetadata);
    metadata.addIndex(
      <string>propertyKey,
      options?.group || <string>propertyKey,
      options?.crossInstance,
      options?.unique,
    );
  },
);

/**
 * Database Table Field type decorator.
 */
export const Field = MakePropertyDecorator(
  (target, propertyKey, type: FieldType) => {
    const metadata = getMetadata(target.constructor, DatumStaticMetadata);
    metadata.fields[propertyKey as string] = type;
  },
);

type AwaitableArray<T> = Promise<T | T[]> | T | T[];
/**
 * Database Table class decorator to create default data on table creation.
 *
 * @param generator Data generator
 */
export const Fixture: <T extends typeof Table>(
  generator: (p: T) => AwaitableArray<Partial<InstanceType<T>>>,
) => ClassDecorator<T> = MakeClassDecorator((target, generator) => {
  const metadata = getMetadata(target, DatumStaticMetadata);
  metadata.generator = generator as unknown as DatumStaticMetadata["generator"];
});
