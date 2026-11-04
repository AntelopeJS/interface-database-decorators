import {
  type Class,
  type ClassDecorator,
  MakeClassDecorator,
} from "@antelopejs/interface-core/decorators";
import { Schema } from "@antelopejs/interface-database";

import type { Table } from "./table";
import { DatumStaticMetadata, getMetadata } from "./common";

const schemaTableRegistry = new Map<string, Record<string, Class<Table>>>();

export const RegisterTable: (
  tableName: string,
  schemaName: string,
) => ClassDecorator<typeof Table> = MakeClassDecorator(
  (target, tableName: string, schemaName: string) => {
    const metadata = getMetadata(target, DatumStaticMetadata);
    metadata.tableName = tableName;
    metadata.schemaName = schemaName;
    metadata.schema = Schema.get(schemaName);

    const tables = schemaTableRegistry.get(schemaName) ?? {};
    tables[tableName] = target;
    schemaTableRegistry.set(schemaName, tables);
  },
);

export function getTablesForSchema(
  schemaName: string,
): Record<string, Class<Table>> | undefined {
  return schemaTableRegistry.get(schemaName);
}
