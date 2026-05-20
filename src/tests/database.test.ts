import { Schema } from "@antelopejs/interface-database";
import { RegisterSchema } from "@antelopejs/interface-database-decorators/database";
import { RegisterTable } from "@antelopejs/interface-database-decorators/schema";
import {
  Fixture,
  Index,
  Table,
} from "@antelopejs/interface-database-decorators/table";
import { expect } from "chai";

describe("Database - initialization", () => {
  it("creates a schema", async () => CreateSchemaTest());
  it("creates tables with default primary key", async () =>
    CreateTablesWithDefaultPrimaryKeyTest());
  it("creates tables with indexes", async () => CreateTablesWithIndexesTest());
  it("creates tables with grouped indexes", async () =>
    CreateTablesWithGroupedIndexesTest());
  it("creates tables with fixture data", async () =>
    CreateTablesWithFixtureDataTest());
  it("handles multiple tables", async () => HandleMultipleTablesTest());
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
  }
  const sortById = (a: any, b: any) => a.id.localeCompare(b.id);
  expect(result.sort(sortById)).to.deep.equal(testData.sort(sortById));
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
