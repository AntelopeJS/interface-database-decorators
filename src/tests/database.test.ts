import { expect } from "chai";
import { Schema } from "@antelopejs/interface-database";
import { RegisterTable } from "@antelopejs/interface-database-decorators/schema";
import { RegisterSchema } from "@antelopejs/interface-database-decorators/database";
import {
  Field,
  Fixture,
  Index,
  Table,
} from "@antelopejs/interface-database-decorators/table";

import { asFieldType, numberCodec } from "./codec_helpers";

describe("Database - initialization", () => {
  it("creates a schema", async () => CreateSchemaTest());
  it("creates tables with default primary key", async () =>
    CreateTablesWithDefaultPrimaryKeyTest());
  it("creates tables with indexes", async () => CreateTablesWithIndexesTest());
  it("creates tables with grouped indexes", async () =>
    CreateTablesWithGroupedIndexesTest());
  it("marks a single-field index as cross-instance", async () =>
    MarksSingleFieldIndexCrossInstanceTest());
  it("marks a group index as cross-instance when one member sets it", async () =>
    MarksGroupIndexCrossInstanceTest());
  it("leaves index definitions unchanged without crossInstance", async () =>
    LeavesIndexDefinitionsUnchangedTest());
  it("creates tables with fixture data", async () =>
    CreateTablesWithFixtureDataTest());
  it("handles multiple tables", async () => HandleMultipleTablesTest());
  it("populates TableDefinition.fields from @Field declarations", () =>
    PopulatesTableDefinitionFieldsTest());
});

async function CreateSchemaTest() {
  @RegisterTable("test_table", "test-new-schema")
  class _TestTable extends Table {
    declare name: string;
  }

  await RegisterSchema("test-new-schema");

  const schema = Schema.get("test-new-schema");
  expect(schema).to.not.equal(undefined);
}

async function CreateTablesWithDefaultPrimaryKeyTest() {
  @RegisterTable("pk_table", "test-pk-schema")
  class _TestTable extends Table {
    declare name: string;
  }

  await RegisterSchema("test-pk-schema");

  const schema = Schema.get("test-pk-schema");
  expect(schema).to.not.equal(undefined);
}

async function CreateTablesWithIndexesTest() {
  @RegisterTable("idx_table", "test-idx-schema")
  class _TestTable extends Table {
    @Index()
    declare name: string;

    @Index()
    declare email: string;
  }

  await RegisterSchema("test-idx-schema");

  const schema = Schema.get("test-idx-schema");
  expect(schema).to.not.equal(undefined);
}

async function CreateTablesWithGroupedIndexesTest() {
  @RegisterTable("grp_table", "test-grp-schema")
  class _TestTable extends Table {
    @Index({ group: "user_search" })
    declare name: string;

    @Index({ group: "user_search" })
    declare email: string;

    @Index({ group: "age_range" })
    declare age: number;
  }

  await RegisterSchema("test-grp-schema");

  const schema = Schema.get("test-grp-schema");
  expect(schema).to.not.equal(undefined);
}

async function MarksSingleFieldIndexCrossInstanceTest() {
  @RegisterTable("cross_single", "test-cross-single-schema")
  class _TestTable extends Table {
    @Index({ crossInstance: true })
    declare email: string;

    @Index()
    declare name: string;
  }

  await RegisterSchema("test-cross-single-schema");

  const indexes = getIndexDefinitions(
    "test-cross-single-schema",
    "cross_single",
  );
  expect(indexes).to.deep.equal({
    email: { fields: undefined, crossInstance: true },
    name: { fields: undefined },
  });
}

async function MarksGroupIndexCrossInstanceTest() {
  @RegisterTable("cross_group", "test-cross-group-schema")
  class _TestTable extends Table {
    @Index({ group: "user_search" })
    declare name: string;

    @Index({ group: "user_search", crossInstance: true })
    declare email: string;

    @Index({ group: "age_range" })
    declare age: number;
  }

  await RegisterSchema("test-cross-group-schema");

  const indexes = getIndexDefinitions("test-cross-group-schema", "cross_group");
  expect(indexes).to.deep.equal({
    user_search: { fields: ["name", "email"], crossInstance: true },
    age_range: { fields: ["age"] },
  });
}

async function LeavesIndexDefinitionsUnchangedTest() {
  @RegisterTable("cross_none", "test-cross-none-schema")
  class _TestTable extends Table {
    @Index()
    declare name: string;

    @Index({ group: "user_search" })
    declare email: string;
  }

  await RegisterSchema("test-cross-none-schema");

  const indexes = getIndexDefinitions("test-cross-none-schema", "cross_none");
  expect(indexes).to.deep.equal({
    name: { fields: undefined },
    user_search: { fields: ["email"] },
  });
  const hasCrossInstanceKey = Object.values(indexes).some(
    (index) => "crossInstance" in index,
  );
  expect(hasCrossInstanceKey).to.equal(false);
}

function getIndexDefinitions(schemaId: string, tableName: string) {
  const schema = Schema.get(schemaId);
  if (!schema) throw new Error("Schema not found");
  return schema.definition[tableName].indexes;
}

async function CreateTablesWithFixtureDataTest() {
  const testData = [
    { id: "1", name: "Test User 1" },
    { id: "2", name: "Test User 2" },
  ];

  @Fixture(() => testData)
  @RegisterTable("fixture_table", "test-fixture-schema")
  class _TestTable extends Table {
    declare name: string;
  }

  await RegisterSchema("test-fixture-schema");

  const schema = Schema.get("test-fixture-schema");
  if (!schema) throw new Error("Schema not found");
  const result = await schema.instance().table("fixture_table");
  for (const val of result) {
    delete val._id;
    delete val._instance;
  }
  const sortById = (a: any, b: any) => a.id.localeCompare(b.id);
  expect(result.sort(sortById)).to.deep.equal(testData.sort(sortById));
}

async function PopulatesTableDefinitionFieldsTest() {
  @RegisterTable("orders", "test-fields-schema")
  class _Order extends Table {
    @Field("string")
    declare status: string;

    @Field(asFieldType(numberCodec))
    declare total: number;

    declare untyped: string;
  }
  await RegisterSchema("test-fields-schema");
  const schema = Schema.get("test-fields-schema");
  if (!schema) throw new Error("Schema not found");
  const fields = schema.definition.orders.fields;
  expect(fields.status).to.equal("string");
  expect(fields.total).to.equal(numberCodec);
  expect("untyped" in fields).to.equal(false);
}

async function HandleMultipleTablesTest() {
  @RegisterTable("users", "test-multi-table-schema")
  class _UserTable extends Table {
    @Index()
    declare email: string;

    declare name: string;
  }

  @RegisterTable("products", "test-multi-table-schema")
  class _ProductTable extends Table {
    @Index()
    declare name: string;

    declare price: number;
  }

  await RegisterSchema("test-multi-table-schema");

  const schema = Schema.get("test-multi-table-schema");
  expect(schema).to.not.equal(undefined);
}
