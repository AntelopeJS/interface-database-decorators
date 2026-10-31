import type { Schema } from "@antelopejs/interface-database";
import type { FieldType } from "@antelopejs/interface-database/schema";

import { isObjectLike } from "./modifiers/internal/kinds";

export type Constructible<T = object, A extends unknown[] = unknown[]> = new (
  ...args: A
) => T;

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U1>
    ? Array<DeepPartial<U1>>
    : T[K] extends ReadonlyArray<infer U2>
      ? ReadonlyArray<DeepPartial<U2>>
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

/**
 * A table row as `toPlainData` gives it: the fields of `T` that are set, by
 * name, without the row's prototype.
 */
export type PlainRow<T> = { [K in Extract<keyof T, string>]?: T[K] };

/**
 * A table row as `fromPlainData` reads it: every field is optional and may be
 * partial, and a field under a container modifier, such as a localized one, may
 * hold its value per key.
 */
export type PlainData<T> = {
  [K in Extract<keyof T, string>]?:
    | T[K]
    | DeepPartial<T>[K]
    | Record<string, DeepPartial<T>[K]>;
};

/**
 * The rows a fixture generator gives for its table: one, several or none.
 */
export type DatumGeneratorOutput<Row extends object = object> =
  | Row
  | Row[]
  | undefined;
/**
 * A fixture generator of a table class, called with the class registered into
 * the schema: the decorated class or a subclass of it.
 */
export type DatumGenerator = (
  tableClass: Constructible,
) => DatumGeneratorOutput | Promise<DatumGeneratorOutput>;

export interface MetadataClass<TMetadata> extends Constructible<TMetadata> {
  key: symbol;
  /**
   * Builds the metadata a subclass starts from out of its parent's, copying
   * whatever a decorator on the subclass would write to. Without it, the
   * subclass shares its parent's metadata object.
   */
  inherit?: (parent: TMetadata) => TMetadata;
  /**
   * Brings metadata stored under the shared key by an older copy of the
   * package to this copy's shape. Returns `stored` itself when it is already
   * current.
   */
  upgrade?: (stored: TMetadata) => TMetadata;
}

/**
 * Table class Metadata.
 */
export class DatumStaticMetadata {
  public static key = Symbol.for(
    "@antelopejs/interface-database-decorators/DatumStaticMetadata@1",
  );

  /**
   * The metadata of a subclass of a table: a copy of its parent's, so that
   * decorators on the subclass never write into the parent or its siblings.
   * The bound schema is not copied: `RegisterSchema` binds the parent after a
   * subclass may have been read, so the subclass looks the schema up by name.
   */
  public static inherit(parent: DatumStaticMetadata): DatumStaticMetadata {
    const copy = new DatumStaticMetadata();
    copy.tableName = parent.tableName;
    copy.schemaName = parent.schemaName;
    for (const [group, keys] of Object.entries(parent.indexes)) {
      copy.indexes[group] = [...keys];
    }
    for (const group of parent.crossInstanceIndexes) {
      copy.crossInstanceIndexes.add(group);
    }
    for (const group of parent.uniqueIndexes) {
      copy.uniqueIndexes.add(group);
    }
    for (const [name, type] of Object.entries(parent.fields)) {
      copy.fields[name] = type;
    }
    copy.primary = parent.primary;
    copy.generator = parent.generator;
    return copy;
  }

  /**
   * Copies 0.1.8 and 0.1.9 of the package store the metadata without
   * `uniqueIndexes`, under the same key and class shape as this copy.
   */
  public static upgrade(stored: DatumStaticMetadata): DatumStaticMetadata {
    return Object.hasOwn(stored, "uniqueIndexes")
      ? stored
      : Object.assign(new DatumStaticMetadata(), stored);
  }

  public tableName?: string;
  public schemaName?: string;
  public readonly indexes: Record<string, Array<string>> = {};
  public readonly crossInstanceIndexes = new Set<string>();
  public readonly uniqueIndexes = new Set<string>();
  public readonly fields: Record<string, FieldType> = {};
  public primary = "_id" as const;
  public generator?: DatumGenerator;
  /**
   * Schema the table was registered into by `RegisterSchema`.
   */
  public schema?: Schema<any>;

  addIndex(
    key: string,
    group: string,
    isCrossInstance: boolean = false,
    isUnique: boolean = false,
  ) {
    if (!Object.hasOwn(this.indexes, group)) {
      this.indexes[group] = [];
    }
    this.indexes[group].push(key);
    if (isCrossInstance) {
      this.crossInstanceIndexes.add(group);
    }
    if (isUnique) {
      this.uniqueIndexes.add(group);
    }
  }
}

export function getMetadata<TMetadata, TTarget extends object>(
  target: TTarget,
  metadataClass: MetadataClass<TMetadata>,
  inherit: boolean = true,
): TMetadata {
  const existingMetadata = Reflect.getOwnMetadata(metadataClass.key, target) as
    | TMetadata
    | undefined;
  if (existingMetadata) {
    const upgraded = metadataClass.upgrade?.(existingMetadata);
    if (upgraded && upgraded !== existingMetadata) {
      Reflect.defineMetadata(metadataClass.key, upgraded, target);
    }
    return upgraded ?? existingMetadata;
  }

  const prototype: unknown = Object.getPrototypeOf(target);
  const inheritedMetadata =
    inherit &&
    isObjectLike(prototype) &&
    Reflect.hasOwnMetadata(metadataClass.key, prototype)
      ? getMetadata(prototype, metadataClass, false)
      : undefined;
  const metadata =
    inheritedMetadata && metadataClass.inherit
      ? metadataClass.inherit(inheritedMetadata)
      : (inheritedMetadata ?? new metadataClass(target));
  Reflect.defineMetadata(metadataClass.key, metadata, target);
  return metadata;
}
