import {
  DatumStaticMetadata,
  getMetadata,
} from "@antelopejs/interface-database-decorators/common";
import { MixinSymbol } from "@antelopejs/interface-database-decorators/modifiers/common";
import {
  Field,
  Fixture,
  Index,
  Table,
} from "@antelopejs/interface-database-decorators/table";
import { expect } from "chai";
import { asFieldType, stringCodec } from "./codec_helpers";

describe("Table - decorators", () => {
  it("creates table with default primary key", async () =>
    CreateTableWithDefaultPrimaryKeyTest());
  it("creates table with multiple indexes", async () =>
    CreateTableWithMultipleIndexesTest());
  it("creates table with grouped indexes", async () =>
    CreateTableWithGroupedIndexesTest());
  it("creates table with fixture data", async () =>
    CreateTableWithFixtureDataTest());
  it("combines table with mixins", async () => CombineTableWithMixinsTest());
});

async function CreateTableWithDefaultPrimaryKeyTest() {
  class TestTable extends Table {
    @Index()
    name!: string;
  }

  const metadata = getMetadata(TestTable, DatumStaticMetadata);

  expect(metadata.primary).to.equal("_id");
  expect(metadata.indexes.name).to.deep.equal(["name"]);
}

async function CreateTableWithMultipleIndexesTest() {
  class TestTable extends Table {
    @Index()
    email!: string;

    @Index()
    age!: number;
  }

  const metadata = getMetadata(TestTable, DatumStaticMetadata);

  expect(metadata.primary).to.equal("_id");
  expect(metadata.indexes.email).to.deep.equal(["email"]);
  expect(metadata.indexes.age).to.deep.equal(["age"]);
}

async function CreateTableWithGroupedIndexesTest() {
  class TestTable extends Table {
    @Index({ group: "user_search" })
    name!: string;

    @Index({ group: "user_search" })
    email!: string;

    @Index({ group: "age_range" })
    age!: number;
  }

  const metadata = getMetadata(TestTable, DatumStaticMetadata);

  expect(metadata.primary).to.equal("_id");
  expect(metadata.indexes.user_search).to.deep.equal(["name", "email"]);
  expect(metadata.indexes.age_range).to.deep.equal(["age"]);
}

async function CreateTableWithFixtureDataTest() {
  const testData = [
    { id: "1", name: "Test User 1" },
    { id: "2", name: "Test User 2" },
  ];

  @Fixture(() => testData)
  class TestTable extends Table {
    name!: string;
  }

  const metadata = getMetadata(TestTable, DatumStaticMetadata);

  expect(metadata.generator).to.be.a("function");
  expect(metadata.primary).to.equal("_id");
}

describe("Table - @Field decorator", () => {
  it("stores a string-token type on metadata.fields", () =>
    StoresStringTokenFieldTest());
  it("stores an io-ts codec on metadata.fields", () => StoresCodecFieldTest());
  it("stacks with @Index", () => StacksWithIndexTest());
});

function StoresStringTokenFieldTest() {
  class _T extends Table {
    @Field("string")
    declare name: string;
  }
  const metadata = getMetadata(_T, DatumStaticMetadata);
  expect(metadata.fields.name).to.equal("string");
}

function StoresCodecFieldTest() {
  class _T extends Table {
    @Field(asFieldType(stringCodec))
    declare name: string;
  }
  const metadata = getMetadata(_T, DatumStaticMetadata);
  expect(metadata.fields.name).to.equal(stringCodec);
}

function StacksWithIndexTest() {
  class _T extends Table {
    @Index()
    @Field("string")
    declare email: string;
  }
  const metadata = getMetadata(_T, DatumStaticMetadata);
  expect(metadata.fields.email).to.equal("string");
  expect(metadata.indexes.email).to.deep.equal(["email"]);
}

async function CombineTableWithMixinsTest() {
  class TestMixin {
    testMethodUnunvailable() {
      return "This method should be undefined";
    }

    [MixinSymbol] = class {
      testMethod() {
        return "mixin method ok";
      }
    };
  }

  class TestTable extends Table.with(TestMixin) {
    name!: string;
  }

  const instance = new TestTable();
  expect(instance).to.have.property("testMethod");
  expect((instance as any).testMethod()).to.equal("mixin method ok");
  expect(instance).to.not.have.property("testMethodUnunvailable");
  expect(instance).to.have.property("name");
  expect(instance).to.be.instanceOf(TestTable);
}
