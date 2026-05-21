import {
  Controller,
  Get,
  type RequestContext,
} from "@antelopejs/interface-api";
import { CROSS_INSTANCE } from "@antelopejs/interface-database";
import { RegisterSchema } from "@antelopejs/interface-database-decorators/database";
import {
  BasicDataModel,
  GetModel,
  Model,
} from "@antelopejs/interface-database-decorators/model";
import { RegisterTable } from "@antelopejs/interface-database-decorators/schema";
import { Field, Table } from "@antelopejs/interface-database-decorators/table";
import { expect } from "chai";
import { asFieldType, numberCodec, stringCodec } from "./codec_helpers";

describe("Model - data operations", () => {
  it("creates basic data model", async () => CreateBasicDataModelTest());
  it("creates basic data model from metadata", async () =>
    CreateBasicDataModelFromMetadataTest());
  it("converts plain data to table instance", async () =>
    ConvertPlainDataToTableTest());
  it("converts database data to table instance", async () =>
    ConvertDatabaseDataToTableTest());
  it("converts table instance to database data", async () =>
    ConvertTableToDatabaseDataTest());
  it("handles null database data", async () => HandleNullDatabaseDataTest());
  it("gets model from cache", async () => GetModelFromCacheTest());
  it("creates new model when not cached", async () =>
    CreateNewModelWhenNotCachedTest());
  it("handles model with string instance id", async () =>
    HandleModelWithStringInstanceIdTest());
  it("handles model with callback instance id", async () =>
    HandleModelWithCallbackInstanceIdTest());
});

describe("Model - validate", () => {
  it("returns ok for valid input", () => ValidateOkTest());
  it("returns errors for invalid input", () => ValidateErrorsTest());
  it("returns ok for unannotated tables", () => ValidateUnannotatedTest());
  it("skips string-token fields", () => ValidateSkipsStringTokensTest());
  it("rejects partial input by default", () =>
    ValidatePartialDefaultsToStrictTest());
  it("accepts partial input with partial:true", () =>
    ValidatePartialModeAcceptsAbsentTest());
  it("still rejects present-but-invalid fields in partial mode", () =>
    ValidatePartialModeChecksPresentFieldsTest());
});

function ValidateOkTest() {
  @RegisterTable("v_ok", "model-validate-schema")
  class _T extends Table {
    @Field(asFieldType(stringCodec))
    declare name: string;
    @Field(asFieldType(numberCodec))
    declare age: number;
  }
  const TM = BasicDataModel(_T, "v_ok");
  const result = TM.validate({ name: "Alice", age: 30 });
  expect(result.ok).to.equal(true);
}

function ValidateErrorsTest() {
  @RegisterTable("v_err", "model-validate-schema")
  class _T extends Table {
    @Field(asFieldType(stringCodec))
    declare name: string;
    @Field(asFieldType(numberCodec))
    declare age: number;
  }
  const TM = BasicDataModel(_T, "v_err");
  const result = TM.validate({ name: 42, age: "old" });
  expect(result.ok).to.equal(false);
  if (result.ok) throw new Error("expected failure branch");
  const fields = result.errors.map((e) => e.field).sort();
  expect(fields).to.deep.equal(["age", "name"]);
}

function ValidateUnannotatedTest() {
  @RegisterTable("v_un", "model-validate-schema")
  class _T extends Table {
    declare name: string;
  }
  const TM = BasicDataModel(_T, "v_un");
  expect(TM.validate({ name: "anything" }).ok).to.equal(true);
  expect(TM.validate({}).ok).to.equal(true);
}

function ValidateSkipsStringTokensTest() {
  @RegisterTable("v_skip", "model-validate-schema")
  class _T extends Table {
    @Field("string")
    declare name: string;
    @Field(asFieldType(numberCodec))
    declare age: number;
  }
  const TM = BasicDataModel(_T, "v_skip");
  expect(TM.validate({ name: 123, age: 4 }).ok).to.equal(true);
  expect(TM.validate({ name: "n", age: "bad" }).ok).to.equal(false);
}

function ValidatePartialDefaultsToStrictTest() {
  @RegisterTable("v_partial_strict", "model-validate-schema")
  class _T extends Table {
    @Field(asFieldType(stringCodec))
    declare name: string;
    @Field(asFieldType(numberCodec))
    declare age: number;
  }
  const TM = BasicDataModel(_T, "v_partial_strict");
  const result = TM.validate({ name: "Alice" });
  expect(result.ok).to.equal(false);
  if (result.ok) throw new Error("expected failure branch");
  expect(result.errors.map((e) => e.field)).to.deep.equal(["age"]);
}

function ValidatePartialModeAcceptsAbsentTest() {
  @RegisterTable("v_partial_accept", "model-validate-schema")
  class _T extends Table {
    @Field(asFieldType(stringCodec))
    declare name: string;
    @Field(asFieldType(numberCodec))
    declare age: number;
  }
  const TM = BasicDataModel(_T, "v_partial_accept");
  expect(TM.validate({ name: "Alice" }, { partial: true }).ok).to.equal(true);
  expect(TM.validate({}, { partial: true }).ok).to.equal(true);
}

function ValidatePartialModeChecksPresentFieldsTest() {
  @RegisterTable("v_partial_check", "model-validate-schema")
  class _T extends Table {
    @Field(asFieldType(stringCodec))
    declare name: string;
    @Field(asFieldType(numberCodec))
    declare age: number;
  }
  const TM = BasicDataModel(_T, "v_partial_check");
  const result = TM.validate({ age: "old" }, { partial: true });
  expect(result.ok).to.equal(false);
  if (result.ok) throw new Error("expected failure branch");
  expect(result.errors.map((e) => e.field)).to.deep.equal(["age"]);
}

async function CreateBasicDataModelTest() {
  class TestTable extends Table {
    name!: string;
    age!: number;
  }

  const TestModel = BasicDataModel(TestTable, "test_table");

  expect(TestModel).to.be.a("function");
  expect(TestModel.name).to.equal("Model");
}

async function CreateBasicDataModelFromMetadataTest() {
  @RegisterTable("meta_table", "model-meta-schema")
  class TestTable extends Table {
    name!: string;
  }

  const TestModel = BasicDataModel(TestTable);

  expect(TestModel).to.be.a("function");
  expect(TestModel.name).to.equal("Model");
}

async function ConvertPlainDataToTableTest() {
  class TestTable extends Table {
    name!: string;
    age!: number;
  }

  const TestModel = BasicDataModel(TestTable, "test_table");
  const plainData = { _id: "1", name: "John", age: 30 };
  const instance = TestModel.fromPlainData(plainData);

  expect(instance).to.be.instanceOf(TestTable);
  expect(instance._id).to.equal("1");
  expect(instance.name).to.equal("John");
  expect(instance.age).to.equal(30);
}

async function ConvertDatabaseDataToTableTest() {
  class TestTable extends Table {
    name!: string;
    age!: number;
  }

  const TestModel = BasicDataModel(TestTable, "test_table");
  const dbData = { _id: "123", name: "John", age: 30 };
  const instance = TestModel.fromDatabase(dbData);

  expect(instance).to.be.instanceOf(TestTable);
  expect(instance?.name).to.equal("John");
  expect(instance?.age).to.equal(30);
}

async function ConvertTableToDatabaseDataTest() {
  class TestTable extends Table {
    name!: string;
    age!: number;
  }

  const TestModel = BasicDataModel(TestTable, "test_table");
  const instance = new TestTable();
  instance._id = "1";
  instance.name = "John";
  instance.age = 30;

  const dbData = TestModel.toDatabase(instance);

  expect(dbData._id).to.equal("1");
  expect(dbData.name).to.equal("John");
  expect(dbData.age).to.equal(30);
}

async function HandleNullDatabaseDataTest() {
  class TestTable extends Table {
    name!: string;
  }

  const TestModel = BasicDataModel(TestTable, "test_table");
  const instance = TestModel.fromDatabase(null);

  expect(instance).to.equal(undefined);
}

async function GetModelFromCacheTest() {
  @RegisterTable("cache_table", "model-cache-schema")
  class TestTable extends Table {
    name!: string;
  }

  const TestModel = BasicDataModel(TestTable, "cache_table");

  await RegisterSchema("model-cache-schema");

  const model1 = GetModel(TestModel, "test-model-cache-db");
  const model2 = GetModel(TestModel, "test-model-cache-db");

  expect(model1).to.equal(model2);
  expect(model1).to.be.instanceOf(TestModel);
}

async function CreateNewModelWhenNotCachedTest() {
  @RegisterTable("nocache_instances", "model-nocache-schema")
  class TestTable extends Table {
    name!: string;
  }

  const TestModel = BasicDataModel(TestTable, "nocache_instances");

  await RegisterSchema("model-nocache-schema");

  const instance1 = GetModel(TestModel, "instance-1");
  const instance2 = GetModel(TestModel, "instance-2");
  const cross = GetModel(TestModel, CROSS_INSTANCE);

  expect(instance1).to.not.equal(instance2);
  expect(instance1).to.not.equal(cross);
  expect(instance2).to.not.equal(cross);
  expect(instance1).to.be.instanceOf(TestModel);
  expect(instance2).to.be.instanceOf(TestModel);
  expect(cross).to.be.instanceOf(TestModel);
}

async function HandleModelWithStringInstanceIdTest() {
  @RegisterTable("static_table", "model-static-schema")
  class TestTable extends Table {
    name!: string;
  }
  const TestModel = BasicDataModel(TestTable, "static_table");
  await RegisterSchema("model-static-schema");
  class _TestService extends Controller("/staticmodel") {
    @Model(TestModel, "test-static-model-db")
    model!: InstanceType<typeof TestModel>;

    @Get("/")
    callback() {
      expect("model" in this).to.equal(true);
      expect(this.model).to.be.instanceOf(TestModel);
    }
  }

  const res = await fetch("http://localhost:5010/staticmodel");
  expect(res.status, res.statusText).to.equal(200);
}

async function HandleModelWithCallbackInstanceIdTest() {
  @RegisterTable("dynamic_table", "model-dynamic-schema")
  class TestTable extends Table {
    name!: string;
  }
  const TestModel = BasicDataModel(TestTable, "dynamic_table");
  await RegisterSchema("model-dynamic-schema");
  class _TestService extends Controller("/dynamicmodel/:database") {
    @Model(TestModel, (ctx: RequestContext) => ctx.routeParameters.database)
    model!: InstanceType<typeof TestModel>;

    @Get("/")
    callback() {
      expect("model" in this).to.equal(true);
      expect(this.model).to.be.instanceOf(TestModel);
    }
  }

  const res = await fetch(
    "http://localhost:5010/dynamicmodel/test-dynamic-model-db",
  );
  expect(res.status, res.statusText).to.equal(200);
}
