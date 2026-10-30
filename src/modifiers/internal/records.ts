/** @internal @packageDocumentation */
import type { DatumStaticMetadata } from "../../common";
import type {
  Modifier,
  ModifiersDynamicMetadata,
  ModifiersStaticMetadata,
} from "../common";

type ModifiedFieldList = ModifiersStaticMetadata["fields"][string];
type ModifiedField = ModifiedFieldList[number];
type InternalRecord = Parameters<ModifiersDynamicMetadata["get"]>[1];

export interface InternalHolder {
  constructor: any;
  _internal?: InternalRecord;
}

/** The modifier state of a table instance, created on first use. */
export function getInternal(object: InternalHolder): InternalRecord {
  if (!object._internal) {
    object._internal = {
      meta: {},
      data: {},
    };
  }
  return object._internal;
}

export function fieldsByKey(meta: ModifiersStaticMetadata): {
  [field: PropertyKey]: ModifiedFieldList;
} {
  return meta.fields;
}

export function eventsByKey(
  meta: ModifiersStaticMetadata,
): Map<
  string,
  Array<[field: PropertyKey, modified: ModifiedFieldList[number]]>
> {
  return meta.events;
}

export function unlockArgsOf(
  meta: ModifiersDynamicMetadata,
  field: PropertyKey,
): ModifiersDynamicMetadata["fields"][string] {
  const byKey: {
    [field: PropertyKey]: ModifiersDynamicMetadata["fields"][string];
  } = meta.fields;
  if (!Object.hasOwn(byKey, field)) {
    throw new TypeError(`${String(field)} holds no modifier arguments`);
  }
  return byKey[field];
}

export function fieldTypesByKey(meta: DatumStaticMetadata): {
  [field: PropertyKey]: DatumStaticMetadata["fields"][string];
} {
  return meta.fields;
}

export function floatingOf<V>(
  meta: { floating: Record<string, V> },
  field: PropertyKey,
): V | undefined {
  const byKey: { [field: PropertyKey]: V } = meta.floating;
  return Object.hasOwn(byKey, field) ? byKey[field] : undefined;
}

export function floatingByKey<V>(meta: { floating: Record<string, V> }): {
  [field: PropertyKey]: V;
} {
  return meta.floating;
}

export function dataByKey<V>(internal: { data: Record<string, V> }): {
  [field: PropertyKey]: V;
} {
  return internal.data;
}

export function withRef<T extends Modifier, U>(
  internal: InternalRecord,
  id: ModifiedField["id"],
  modifier: T,
  metaRef: ModifiedField["metaRef"],
  callback: (modifier: T) => U,
): U {
  metaRef._ref = internal.meta[id];
  const ret = callback(modifier);
  if (metaRef._ref !== internal.meta[id]) {
    internal.meta[id] = metaRef._ref;
  }
  return ret;
}
