/** @internal @packageDocumentation */
import type { DatumStaticMetadata } from "../../common";
import type {
  ModifiersDynamicMetadata,
  ModifiersStaticMetadata,
} from "../common";

type ModifiedFieldList = ModifiersStaticMetadata["fields"][string];

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
  return byKey[field];
}

export function fieldTypesByKey(meta: DatumStaticMetadata): {
  [field: PropertyKey]: DatumStaticMetadata["fields"][string];
} {
  return meta.fields;
}
