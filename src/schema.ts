import {
  type Class,
  type ClassDecorator,
  MakeClassDecorator,
} from "@antelopejs/interface-core/decorators";
import { Schema } from "@antelopejs/interface-database";

import type { Table } from "./table";
import { DatumStaticMetadata, getMetadata } from "./common";

const schemaTableRegistry: Record<string, Record<string, Class<Table>>> = {};

export const RegisterTable: (
  tableName: string,
  schemaName: string,
) => ClassDecorator<typeof Table> = MakeClassDecorator(
  (target, tableName: string, schemaName: string) => {
    const metadata = getMetadata(target, DatumStaticMetadata);
    metadata.tableName = tableName;
    metadata.schemaName = schemaName;
    metadata.schema = Schema.get(schemaName);

    if (!(schemaName in schemaTableRegistry)) {
      schemaTableRegistry[schemaName] = {};
    }
    schemaTableRegistry[schemaName][tableName] = target;
  },
);

export function getTablesForSchema(
  schemaName: string,
): Record<string, Class<Table>> | undefined {
  return schemaTableRegistry[schemaName];
}
