import { expect } from "chai";
import { CROSS_INSTANCE } from "@antelopejs/interface-database";
import { Field, Table } from "../table";
import { RegisterTable } from "../schema";
import { RegisterSchema } from "../database";
import {
  Controller,
  Get,
  type RequestContext,
} from "@antelopejs/interface-api";
import { BasicDataModel, GetModel, Model } from "../model";

import { asFieldType, numberCodec, stringCodec } from "./codec_helpers";

describe("Model - data operations", () => {
  it("creates basic data model", async () => {
    class TestTable extends Table {
      name!: string;
      age!: number;
    }

    const TestModel = BasicDataModel(TestTable, "test_table");

    expect(TestModel).to.be.a("function");
    expect(TestModel.name).to.equal("Model");
  });
  it("creates basic data model from metadata", async () => {
    @RegisterTable("meta_table", "model-meta-schema")
    class TestTable extends Table {
      name!: string;
    }

    const TestModel = BasicDataModel(TestTable);

    expect(TestModel).to.be.a("function");
    expect(TestModel.name).to.equal("Model");
  });
  it("converts plain data to table instance", async () => {
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
  });
  it("converts database data to table instance", async () => {
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
  });
  it("converts table instance to database data", async () => {
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
  });
  it("handles null database data", async () => {
    class TestTable extends Table {
      name!: string;
    }

    const TestModel = BasicDataModel(TestTable, "test_table");
    const instance = TestModel.fromDatabase(null);

    expect(instance).to.equal(undefined);
  });
});

describe("Model - data operations", () => {
  it("gets model from cache", async () => {
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
  });
  it("creates new model when not cached", async () => {
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
  });
  it("handles model with string instance id", async () => {
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
  });
  it("handles model with callback instance id", async () => {
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
  });
});

describe("Model - validate", () => {
  it("returns ok for valid input", () => {
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
  });
  it("returns errors for invalid input", () => {
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
  });
  it("returns ok for unannotated tables", () => {
    @RegisterTable("v_un", "model-validate-schema")
    class _T extends Table {
      declare name: string;
    }
    const TM = BasicDataModel(_T, "v_un");
    expect(TM.validate({ name: "anything" }).ok).to.equal(true);
    expect(TM.validate({}).ok).to.equal(true);
  });
  it("skips string-token fields", () => {
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
  });
  it("rejects partial input by default", () => {
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
  });
  it("accepts partial input with partial:true", () => {
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
  });
  it("still rejects present-but-invalid fields in partial mode", () => {
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
  });
});
