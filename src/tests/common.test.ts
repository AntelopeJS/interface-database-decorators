import { expect } from "chai";
import {
  DatumStaticMetadata,
  type DeepPartial,
  getMetadata,
} from "@antelopejs/interface-database-decorators/common";

interface TestType {
  name: string;
  age: number;
  address: {
    street: string;
    city: string;
  };
  hobbies: string[];
}

const _partial: DeepPartial<TestType> = {
  name: "John",
  address: {
    street: "Main St",
  },
  hobbies: ["reading"],
};

describe("Common - metadata", () => {
  it("creates metadata with default values", async () => {
    const metadata = new DatumStaticMetadata();

    expect(metadata.primary).to.equal("_id");
    expect(metadata.indexes).to.deep.equal({});
    expect(metadata.generator).to.equal(undefined);
  });
  it("adds index to metadata", async () => {
    const metadata = new DatumStaticMetadata();

    metadata.addIndex("email", "user_search");
    metadata.addIndex("name", "user_search");

    expect(metadata.indexes.user_search).to.deep.equal(["email", "name"]);
  });
  it("creates new metadata when not exists", async () => {
    class TestClass {}
    const metadata = getMetadata(TestClass, DatumStaticMetadata);

    expect(metadata).to.be.instanceOf(DatumStaticMetadata);
    expect(metadata.primary).to.equal("_id");
  });
  it("retrieves existing metadata", async () => {
    class TestClass {}
    const metadata1 = getMetadata(TestClass, DatumStaticMetadata);
    const metadata2 = getMetadata(TestClass, DatumStaticMetadata);

    expect(metadata1).to.equal(metadata2);
  });
  it("has schemaName undefined by default", async () => {
    const metadata = new DatumStaticMetadata();
    expect(metadata.schemaName).to.equal(undefined);
  });
});
