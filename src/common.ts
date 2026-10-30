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

export type DatumGeneratorOutput =
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | undefined;
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
    copy.schema = parent.schema;
    return copy;
  }

  public tableName?: string;
  public schemaName?: string;
  public readonly indexes: Record<string, Array<string>> = {};
  public readonly crossInstanceIndexes = new Set<string>();
  public readonly uniqueIndexes = new Set<string>();
  public readonly fields: Record<string, FieldType> = {};
  public primary: string = "_id";
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
    return existingMetadata;
  }

  const prototype: unknown = Object.getPrototypeOf(target);
  const inheritedMetadata =
    inherit && isObjectLike(prototype)
      ? (Reflect.getOwnMetadata(metadataClass.key, prototype) as
          | TMetadata
          | undefined)
      : undefined;
  const metadata =
    inheritedMetadata && metadataClass.inherit
      ? metadataClass.inherit(inheritedMetadata)
      : (inheritedMetadata ?? new metadataClass(target));
  Reflect.defineMetadata(metadataClass.key, metadata, target);
  return metadata;
}
