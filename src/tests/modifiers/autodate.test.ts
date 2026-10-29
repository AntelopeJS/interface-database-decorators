import { expect } from "chai";
import { Field, Table } from "../../table";
import {
  fromPlainData,
  toDatabase,
  triggerEvent,
} from "../../modifiers/common";
import {
  AutoDateModifier,
  CreationTime,
  UpdateTime,
} from "../../modifiers/autodate";

describe("Modifiers - autodate", () => {
  it("sets creation date on insert", async () => {
    const modifier = new TestableAutoDateModifier();
    modifier.setOptions({ type: "created" });

    const object: Parameters<AutoDateModifier["insert"]>[0] = {};
    modifier.insert(object, "createdAt");

    expect(object.createdAt).to.be.an.instanceOf(Date);
  });
  it("sets update date on insert", async () => {
    const modifier = new TestableAutoDateModifier();
    modifier.setOptions({ type: "updated" });

    const object: Parameters<AutoDateModifier["insert"]>[0] = {};
    modifier.insert(object, "updatedAt");

    expect(object.updatedAt).to.be.an.instanceOf(Date);
  });
  it("refreshes update date on update", async () => {
    const modifier = new TestableAutoDateModifier();
    modifier.setOptions({ type: "updated" });

    const previousDate = new Date(0);
    const object = { updatedAt: previousDate };
    modifier.update(object, "updatedAt");

    expect(object.updatedAt).to.be.an.instanceOf(Date);
    expect(object.updatedAt).to.not.equal(previousDate);
  });
  it("preserves creation date on update", async () => {
    const modifier = new TestableAutoDateModifier();
    modifier.setOptions({ type: "created" });

    const object = { createdAt: new Date(0) };
    modifier.update(object, "createdAt");

    expect(object).to.not.have.property("createdAt");
  });
  it("handles decorators through events", async () => {
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
  });
  it("omits creation date from update database payloads", async () => {
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
  });
});

interface AutoDateOptions {
  type: "created" | "updated";
}

class TestableAutoDateModifier extends AutoDateModifier {
  public setOptions(options: AutoDateOptions) {
    this.options = options;
  }
}
