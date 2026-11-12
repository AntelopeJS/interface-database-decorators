/** @internal @packageDocumentation */

import {
  Schema,
  type SchemaInstance,
  type Table,
} from "@antelopejs/interface-database";

import type { DatumStaticMetadata } from "../common";

/**
 * The table named `tableName` in a schema instance, holding rows of type `T`:
 * the caller names the table its table class is registered under.
 */
export function tableOf<T>(
  instance: SchemaInstance<unknown>,
  tableName: string,
): Table<T> {
  // SAFETY: a schema instance looks its tables up by a runtime name, so its type cannot tie a name to a row type; each caller passes the name its table class T is registered under, whose stored rows are that class's records.
  const rows = instance as SchemaInstance<{ [table: string]: T }>;
  return rows.table(tableName);
}

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
