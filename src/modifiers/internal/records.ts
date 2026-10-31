/** @internal @packageDocumentation */
import type { DatumStaticMetadata } from "../../common";
import type {
  Modifier,
  ModifierEvent,
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

/**
 * Throws when a modifier cannot be attached to the field named `field`: the
 * two names the table's own structures live under.
 */
export function assertModifiableField(
  tableName: string,
  modifierId: string,
  field: PropertyKey,
): void {
  const reason =
    field === "constructor"
      ? "the field would replace the class constructor that locates the metadata of every instance"
      : field === "__proto__"
        ? "the field would replace the prototype of the record of modified fields and never be recorded"
        : undefined;
  if (reason) {
    throw new Error(
      `Cannot add Modifier ${modifierId} on ${tableName}.${String(field)}: ${reason}.`,
    );
  }
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
  Array<
    [
      field: PropertyKey,
      modified: ModifiedFieldList[number],
      handler: ModifierEvent,
    ]
  >
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

/** The entries of a record or map with every list copied, not shared. */
function listsCopied<K, V>(
  entries: Iterable<readonly [K, readonly V[]]>,
): Array<[K, V[]]> {
  return Array.from(entries, ([key, list]) => [key, [...list]]);
}

/** Fills `copy` with the modified fields and events of `parent`, every list copied. */
export function copyModifierLists(
  copy: ModifiersStaticMetadata,
  parent: ModifiersStaticMetadata,
): ModifiersStaticMetadata {
  copy.fields = Object.fromEntries(listsCopied(Object.entries(parent.fields)));
  copy.events = new Map(listsCopied(parent.events));
  return copy;
}
