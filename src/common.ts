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

export function getMetadata<TMetadata, TTarget extends object>(
  target: TTarget,
  metadataClass: MetadataClass<TMetadata>,
  inherit: boolean = true,
): TMetadata {
  // SAFETY: this function is the package's only writer of metadataClass.key (the Reflect.defineMetadata call below), and it stores either a new metadataClass instance or the entry inherited from the prototype under the same key; the value is a TMetadata unless foreign code stores something else under that Symbol.for key.
  const existingMetadata = Reflect.getOwnMetadata(metadataClass.key, target) as
    | TMetadata
    | undefined;
  if (existingMetadata) {
    return existingMetadata;
  }

  // SAFETY: target extends object, so Object.getPrototypeOf returns an object or null, and null is handled below; the value is only used as the lookup target of Reflect.getOwnMetadata, which reads no TTarget member.
  const prototype = Object.getPrototypeOf(target) as TTarget | null;
  // SAFETY: the prototype's own entry under metadataClass.key was stored by this function (see above), so it is a TMetadata unless foreign code stored another value under that key.
  const inheritedMetadata =
    inherit && prototype
      ? (Reflect.getOwnMetadata(metadataClass.key, prototype) as
          | TMetadata
          | undefined)
      : undefined;
  const metadata = inheritedMetadata ?? new metadataClass(target);
  Reflect.defineMetadata(metadataClass.key, metadata, target);
  return metadata;
}
