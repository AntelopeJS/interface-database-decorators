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
  const metadata = inheritedMetadata ?? new metadataClass(target);
  Reflect.defineMetadata(metadataClass.key, metadata, target);
  return metadata;
}
