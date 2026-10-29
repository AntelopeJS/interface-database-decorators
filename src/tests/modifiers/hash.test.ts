import { expect } from "chai";
import { Field, Table } from "../../table";
import { Hashed, HashModifier } from "../../modifiers/hash";

describe("Modifiers - hash", () => {
  it("hashes string values", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const originalValue = "password123";
    const hashed = modifier.lock(undefined, originalValue);

    expect(hashed).to.be.a("string");
    expect(hashed).to.not.equal(originalValue);
    expect(modifier.getMeta().salt).to.be.a("string");
  });
  it("hashes object values", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const originalValue = { name: "John", age: 30 };
    const hashed = modifier.lock(undefined, originalValue);

    expect(hashed).to.be.a("string");
    expect(hashed).to.not.equal(JSON.stringify(originalValue));
  });
  it("handles undefined values", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const hashed = modifier.lock(undefined, undefined);

    expect(hashed).to.equal(undefined);
  });
  it("uses custom hash algorithm", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "md5" });
    modifier.setMeta({});

    const originalValue = "test data";
    const hashed = modifier.lock(undefined, originalValue);

    expect(hashed).to.be.a("string");
    expect(hashed).to.not.equal(originalValue);
    expect(modifier.getOptions().algorithm).to.equal("md5");
  });
  it("generates unique salt for each field", async () => {
    const modifier1 = new TestableHashModifier();
    modifier1.setOptions({ algorithm: "sha256" });
    modifier1.setMeta({});

    const modifier2 = new TestableHashModifier();
    modifier2.setOptions({ algorithm: "sha256" });
    modifier2.setMeta({});

    const value = "test data";
    const hashed1 = modifier1.lock(undefined, value);
    const hashed2 = modifier2.lock(undefined, value);

    expect(hashed1).to.not.equal(hashed2);
    expect(modifier1.getMeta().salt).to.not.equal(modifier2.getMeta().salt);
  });
  it("handles hash decorator", async () => {
    class TestTable extends Table.with(HashModifier) {
      @Hashed({ algorithm: "sha256" })
      @Field("string")
      declare password: string;
    }

    const instance = new TestTable();
    instance.password = "myPassword123";

    expect(instance.testHash("password", "myPassword123")).to.equal(true);
    expect(instance.testHash("password", "notMyPassword")).to.equal(false);
  });
  it("tests hash values correctly", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const originalValue = "test data";
    const hashed = modifier.lock(undefined, originalValue);

    const isMatch = modifier.test(hashed, originalValue);
    const isNotMatch = modifier.test(hashed, "wrong data");

    expect(isMatch).to.equal(true);
    expect(isNotMatch).to.equal(false);
  });
  it("provides testHash method through mixin", async () => {
    class TestTable extends Table.with(HashModifier) {
      @Hashed({ algorithm: "sha256" })
      @Field("string")
      declare password: string;
    }

    const instance = new TestTable();
    instance.password = "myPassword123";

    expect(instance).to.have.property("testHash").that.is.a("function");

    const isMatch = instance.testHash("password", "myPassword123");
    const isNotMatch = instance.testHash("password", "wrongPassword");

    expect(isMatch).to.equal(true);
    expect(isNotMatch).to.equal(false);
  });
});

interface HashOptions {
  algorithm?: string;
}

interface HashMeta {
  salt?: string;
}

class TestableHashModifier extends HashModifier {
  public setOptions(options: HashOptions) {
    this.options = options;
  }

  public getOptions(): HashOptions {
    return this.options;
  }

  public getMeta(): HashMeta {
    return this.meta;
  }

  public setMeta(meta: HashMeta) {
    this.meta = meta;
  }
}
