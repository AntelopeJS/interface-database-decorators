import {
  AutoDateModifier,
  CreationTime,
  UpdateTime,
} from "@antelopejs/interface-database-decorators/modifiers/autodate";
import {
  fromPlainData,
  toDatabase,
  triggerEvent,
} from "@antelopejs/interface-database-decorators/modifiers/common";
import { Field, Table } from "@antelopejs/interface-database-decorators/table";
import { expect } from "chai";

describe("Modifiers - autodate", () => {
  it("sets creation date on insert", async () => SetCreationDateOnInsertTest());
  it("sets update date on insert", async () => SetUpdateDateOnInsertTest());
  it("refreshes update date on update", async () =>
    RefreshUpdateDateOnUpdateTest());
  it("preserves creation date on update", async () =>
    PreserveCreationDateOnUpdateTest());
  it("handles decorators through events", async () =>
    HandleDecoratorsThroughEventsTest());
  it("omits creation date from update database payloads", async () =>
    OmitCreationDateFromUpdatePayloadTest());
});

interface AutoDateOptions {
  type: "created" | "updated";
}

class TestableAutoDateModifier extends AutoDateModifier {
  public setOptions(options: AutoDateOptions) {
    this.options = options;
  }
}

async function SetCreationDateOnInsertTest() {
  const modifier = new TestableAutoDateModifier();
  modifier.setOptions({ type: "created" });

  const object: Record<string, unknown> = {};
  modifier.insert(object, "createdAt");

  expect(object.createdAt).to.be.an.instanceOf(Date);
}

async function SetUpdateDateOnInsertTest() {
  const modifier = new TestableAutoDateModifier();
  modifier.setOptions({ type: "updated" });

  const object: Record<string, unknown> = {};
  modifier.insert(object, "updatedAt");

  expect(object.updatedAt).to.be.an.instanceOf(Date);
}

async function RefreshUpdateDateOnUpdateTest() {
  const modifier = new TestableAutoDateModifier();
  modifier.setOptions({ type: "updated" });

  const previousDate = new Date(0);
  const object: Record<string, unknown> = { updatedAt: previousDate };
  modifier.update(object, "updatedAt");

  expect(object.updatedAt).to.be.an.instanceOf(Date);
  expect(object.updatedAt).to.not.equal(previousDate);
}

async function PreserveCreationDateOnUpdateTest() {
  const modifier = new TestableAutoDateModifier();
  modifier.setOptions({ type: "created" });

  const object: Record<string, unknown> = { createdAt: new Date(0) };
  modifier.update(object, "createdAt");

  expect(object).to.not.have.property("createdAt");
}

async function HandleDecoratorsThroughEventsTest() {
  class TestTable extends Table {
    @CreationTime()
    @Field("date")
    declare createdAt: Date;

    @UpdateTime()
    @Field("date")
    declare updatedAt: Date;
  }

  const instance = new TestTable();
  triggerEvent(instance, "insert");

  expect(instance.createdAt).to.be.an.instanceOf(Date);
  expect(instance.updatedAt).to.be.an.instanceOf(Date);

  const insertedUpdateDate = instance.updatedAt;
  triggerEvent(instance, "update");

  expect(instance.createdAt).to.equal(undefined);
  expect(instance.updatedAt).to.be.an.instanceOf(Date);
  expect(instance.updatedAt).to.not.equal(insertedUpdateDate);
}

async function OmitCreationDateFromUpdatePayloadTest() {
  class TestTable extends Table {
    @CreationTime()
    @Field("date")
    declare createdAt: Date;

    @UpdateTime()
    @Field("date")
    declare updatedAt: Date;
  }

  const inserted = fromPlainData({}, TestTable);
  triggerEvent(inserted, "insert");
  const insertPayload = toDatabase(inserted);

  expect(insertPayload.createdAt).to.be.an.instanceOf(Date);
  expect(insertPayload.updatedAt).to.be.an.instanceOf(Date);

  const updated = fromPlainData({ createdAt: new Date(0) }, TestTable);
  triggerEvent(updated, "update");
  const updatePayload = toDatabase(updated);

  expect(updatePayload).to.not.have.property("createdAt");
  expect(updatePayload.updatedAt).to.be.an.instanceOf(Date);
}
