/** @internal @packageDocumentation */

import { Schema } from "@antelopejs/interface-database";

import type { DatumStaticMetadata } from "../common";

/**
 * The schema a table is bound to: the one `RegisterSchema` bound it to, else
 * the one registered under its schema name. A subclass starts without a bound
 * schema, so it follows its parent's schema whenever `RegisterSchema` binds it.
 */
export function boundSchema({ schema, schemaName }: DatumStaticMetadata) {
  return (
    schema ?? (schemaName === undefined ? undefined : Schema.get(schemaName))
  );
}
