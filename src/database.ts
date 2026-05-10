import assert from "node:assert";
import type { Class } from "@antelopejs/interface-core/decorators";
import {
  Schema,
  type SchemaDefinition,
  type SchemaOptions,
} from "@antelopejs/interface-database";
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
 * builds a `SchemaDefinition` (including the per-table `tenantScoped` flag
 * set by `@TenantScoped`), constructs the `Schema` (which the adapter
 * provisions in its physical store), then inserts fixtures for any
 * non-tenant-scoped table that declares one.
 *
 * Tenant-scoped tables cannot carry fixtures: there is no global tenant id
 * to stamp them with. Boot-time seeding of tenant data should be done via
 * an explicit "create tenant" hook in the application.
 *
 * @param schemaId Schema id matching the `@RegisterTable(_, schemaId)` calls
 * @param options  Schema options (e.g. `physicalStore`)
 */
export async function RegisterSchema(
  schemaId: string,
  options?: SchemaOptions,
): Promise<void> {
  const tables = getTablesForSchema(schemaId);
  assert(tables, `No tables registered for schema '${schemaId}'`);

  const definition = buildSchemaDefinition(tables);
  const schema = new Schema(schemaId, definition, options);

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
      tenantScoped: metadata.tenantScoped || undefined,
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
        metadata.tenantScoped,
        metadata.generator,
      );
    }),
  );
}

async function insertFixtureData(
  schema: Schema<any>,
  tableName: string,
  tableClass: Class<Table>,
  tenantScoped: boolean,
  generator: DatumStaticMetadata["generator"],
): Promise<void> {
  if (!generator) {
    return;
  }
  assert(
    !tenantScoped,
    `Fixture on tenant-scoped table '${tableName}' is not supported: there is no implicit tenant id at registration time. Seed tenant data from a create-tenant hook instead.`,
  );
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
