import assert from "node:assert";
import type { Class } from "@antelopejs/interface-core/decorators";
import { Schema, type SchemaDefinition } from "@antelopejs/interface-database";
import type { IndexDefinition } from "@antelopejs/interface-database/schema";
import type { DatumGeneratorOutput } from "./common";
import { DatumStaticMetadata, getMetadata } from "./common";
import { fromPlainData, toDatabase, triggerEvent } from "./modifiers/common";
import { getTablesForSchema } from "./schema";
import type { Table } from "./table";

type TableDefinitions = Record<string, Class<Table>>;
type TableEntry = Record<string, unknown>;

/**
 * Registers a schema with the database adapter and runs any fixtures.
 *
 * Reads the table classes registered for `schemaId` via `@RegisterTable`,
 * builds a `SchemaDefinition`, constructs the `Schema` (which the adapter
 * provisions), then inserts fixtures for any table that declares one.
 *
 * @param schemaId Schema id matching the `@RegisterTable(_, schemaId)` calls
 */
export async function RegisterSchema(schemaId: string): Promise<void> {
  const tables = getTablesForSchema(schemaId);
  assert(tables, `No tables registered for schema '${schemaId}'`);

  const definition = buildSchemaDefinition(tables);
  const schema = new Schema(schemaId, definition);

  await insertAllFixtureData(schema, tables);
}

function buildSchemaDefinition(tables: TableDefinitions): SchemaDefinition {
  const definition: SchemaDefinition = {};
  for (const [tableName, tableClass] of Object.entries(tables)) {
    const metadata = getMetadata(tableClass, DatumStaticMetadata);
    const indexes: Record<string, IndexDefinition> = {};
    for (const [group, fields] of Object.entries(metadata.indexes)) {
      indexes[group] = {
        fields: fields.length === 1 && fields[0] === group ? undefined : fields,
      };
    }
    definition[tableName] = {
      fields: {},
      indexes,
    };
  }
  return definition;
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
  const rows = toFixtureRows(fixtureData, tableClass);
  if (rows.length === 0) {
    return;
  }
  const payload: any = rows.length === 1 ? rows[0] : rows;
  await schema.instance().table(tableName).insert(payload);
}

function toFixtureRows(
  fixtureData: DatumGeneratorOutput,
  tableClass: Class<Table>,
): TableEntry[] {
  const entries = fixtureData
    ? Array.isArray(fixtureData)
      ? fixtureData
      : [fixtureData]
    : [];
  return entries.filter(isTableEntry).map((entry) => {
    const instance = fromPlainData(entry, tableClass);
    triggerEvent(instance, "insert");
    return toDatabase(instance) as TableEntry;
  });
}

function isTableEntry(value: unknown): value is TableEntry {
  return typeof value === "object" && value !== null;
}
