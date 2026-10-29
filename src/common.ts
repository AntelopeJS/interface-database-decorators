import type { Schema } from "@antelopejs/interface-database";
import type { FieldType } from "@antelopejs/interface-database/schema";

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
}

/**
 * Table class Metadata.
 */
export class DatumStaticMetadata {
  public static key = Symbol.for(
    "@antelopejs/interface-database-decorators/DatumStaticMetadata@1",
  );

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
    if (!(group in this.indexes)) {
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

function getOwnMetadata<TMetadata>(
  target: Parameters<typeof Reflect.getOwnMetadata>[1],
  metadataClass: MetadataClass<TMetadata>,
): TMetadata | undefined {
  return Reflect.getOwnMetadata(metadataClass.key, target) as
    | TMetadata
    | undefined;
}

export function getMetadata<TMetadata, TTarget extends object>(
  target: TTarget,
  metadataClass: MetadataClass<TMetadata>,
  inherit: boolean = true,
): TMetadata {
  const existingMetadata = getOwnMetadata(target, metadataClass);
  if (existingMetadata) {
    return existingMetadata;
  }

  const prototype: object | null = Object.getPrototypeOf(target);
  const inheritedMetadata =
    inherit && prototype ? getOwnMetadata(prototype, metadataClass) : undefined;
  const metadata = inheritedMetadata ?? new metadataClass(target);
  Reflect.defineMetadata(metadataClass.key, metadata, target);
  return metadata;
}
