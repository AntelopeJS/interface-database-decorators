import assert from "node:assert";
import type { Class } from "@antelopejs/interface-core/decorators";
import type { IndexDefinition } from "@antelopejs/interface-database/schema";
import { Schema, type SchemaDefinition } from "@antelopejs/interface-database";

import type { Table } from "./table";
import { getTablesForSchema } from "./schema";
import type { DatumGeneratorOutput } from "./common";
import { DatumStaticMetadata, getMetadata } from "./common";
import {
  fromPlainData,
  type StoredRow,
  toDatabase,
  triggerEvent,
} from "./modifiers/common";

type TableDefinitions = Record<string, Class<Table>>;

/**
 * Registers a schema with the database adapter and runs any fixtures.
 *
 * Reads the table classes registered for `schemaId` via `@RegisterTable`,
 * builds a `SchemaDefinition`, constructs the `Schema` (which the adapter
 * provisions), binds each table class to it (see `Table.table`), then
 * inserts fixtures for any table that declares one.
 *
 * @param schemaId Schema id matching the `@RegisterTable(_, schemaId)` calls
 */
export async function RegisterSchema(schemaId: string): Promise<void> {
  const tables = getTablesForSchema(schemaId);
  assert(tables, `No tables registered for schema '${schemaId}'`);

  const definition = buildSchemaDefinition(tables);
  const schema = new Schema(schemaId, definition);
  bindTables(schema, tables);

  await insertAllFixtureData(schema, tables);
}

function bindTables(schema: Schema<any>, tables: TableDefinitions): void {
  for (const tableClass of Object.values(tables)) {
    getMetadata(tableClass, DatumStaticMetadata).schema = schema;
  }
}

function buildSchemaDefinition(tables: TableDefinitions): SchemaDefinition {
  const definition: SchemaDefinition = {};
  for (const [tableName, tableClass] of Object.entries(tables)) {
    const metadata = getMetadata(tableClass, DatumStaticMetadata);
    definition[tableName] = {
      fields: metadata.fields,
      indexes: buildIndexDefinitions(metadata),
    };
  }
  return definition;
}

function buildIndexDefinitions(metadata: DatumStaticMetadata) {
  const indexes: Record<string, IndexDefinition> = {};
  for (const [group, fields] of Object.entries(metadata.indexes)) {
    indexes[group] = {
      fields: fields.length === 1 && fields[0] === group ? undefined : fields,
      ...(metadata.crossInstanceIndexes.has(group) && { crossInstance: true }),
      ...(metadata.uniqueIndexes.has(group) && { unique: true }),
    };
  }
  return indexes;
}

async function insertAllFixtureData(
  schema: Schema<any>,
  tables: TableDefinitions,
): Promise<void> {
  await Promise.all(
    Object.entries(tables).map(([tableName, tableClass]) => {
      const metadata = getMetadata(tableClass, DatumStaticMetadata);
      return insertFixtureData(
        schema,
        tableName,
        tableClass,
        metadata.generator,
      );
    }),
  );
}

async function insertFixtureData(
  schema: Schema<any>,
  tableName: string,
  tableClass: Class<Table>,
  generator: DatumStaticMetadata["generator"],
): Promise<void> {
  if (!generator) {
    return;
  }
  const count = await schema.instance().table(tableName).count();
  if (count > 0) {
    return;
  }
  const fixtureData = await generator(tableClass);
  const rows = toFixtureRows(fixtureData, tableClass).map((row, position) =>
    withStableId(row, tableName, position),
  );
  if (rows.length === 0) {
    return;
  }
  const table = schema.instance().table(tableName);
  try {
    await table.insert(rows.length === 1 ? rows[0] : rows);
  } catch (error) {
    if ((await table.count()) === 0) throw error;
  }
}

/**
 * Keys a fixture row that declares no id by its table and position, so two
 * processes starting on an empty table write one row between them.
 */
function withStableId(
  row: StoredRow<Table>,
  tableName: string,
  position: number,
): StoredRow<Table> {
  return row._id === undefined
    ? { ...row, _id: `${tableName}:fixture:${position}` }
    : row;
}

function toFixtureRows(
  fixtureData: DatumGeneratorOutput,
  tableClass: Class<Table>,
): StoredRow<Table>[] {
  const entries = fixtureData
    ? Array.isArray(fixtureData)
      ? fixtureData
      : [fixtureData]
    : [];
  return entries.filter(isTableEntry).map((entry) => {
    const instance = fromPlainData(entry, tableClass);
    triggerEvent(instance, "insert");
    return toDatabase(instance);
  });
}

function isTableEntry(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
