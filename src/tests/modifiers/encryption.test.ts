import { expect } from "chai";
import { Field, Table } from "@antelopejs/interface-database-decorators/table";
import {
  Encrypted,
  EncryptionModifier,
} from "@antelopejs/interface-database-decorators/modifiers/encryption";

describe("Modifiers - encryption", () => {
  it("creates encryption modifier", async () => {
    const Mixed = Table.with(EncryptionModifier);
    class Sample extends Mixed {
      @Encrypted({ secretKey: "12345678901234567890123456789012" })
      @Field("string")
      declare value: string;
    }

    const instance = new Sample();
    instance.value = "hello";
    expect(instance.value).to.equal("hello");
  });
  it("encrypts and decrypts string values", async () => {
    class User extends Table.with(EncryptionModifier) {
      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        algorithm: "aes-256-cbc",
      })
      @Field("string")
      declare email: string;
    }

    const user = new User();
    user.email = "user@example.com";
    expect(user.email).to.equal("user@example.com");
  });
  it("encrypts and decrypts object values", async () => {
    class Doc extends Table.with(EncryptionModifier) {
      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        algorithm: "aes-256-cbc",
      })
      @Field("any")
      declare meta: { admin: boolean; count: number };
    }

    const doc = new Doc();
    const original = { admin: true, count: 3 };
    doc.meta = original;
    expect(doc.meta).to.deep.equal(original);
  });
  it("encrypts and decrypts array values", async () => {
    class Tags extends Table.with(EncryptionModifier) {
      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        algorithm: "aes-256-cbc",
      })
      @Field("any")
      declare values: (string | { deep: string })[];
    }

    const tags = new Tags();
    const original = ["a", "b", { deep: "x" }];
    tags.values = original;
    expect(tags.values).to.deep.equal(original);
  });
  it("uses custom iv size", async () => {
    class WithIv extends Table.with(EncryptionModifier) {
      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        ivSize: 16,
        algorithm: "aes-256-cbc",
      })
      @Field("string")
      declare data: string;
    }

    const test = new WithIv();
    test.data = "iv test";
    expect(test.data).to.equal("iv test");
  });
});

describe("Modifiers - encryption", () => {
  it("handles encryption decorator", async () => {
    class Secured extends Table.with(EncryptionModifier) {
      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        algorithm: "aes-256-cbc",
      })
      @Field("string")
      declare password: string;

      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        algorithm: "aes-256-cbc",
      })
      @Field("any")
      declare extra: { token: string };
    }

    const secured = new Secured();
    secured.password = "admin123";
    secured.extra = { token: "xyz" };

    expect(secured.password).to.equal("admin123");
    expect(secured.extra).to.deep.equal({ token: "xyz" });
  });
  it("generates unique iv for each encryption", async () => {
    class Message extends Table.with(EncryptionModifier) {
      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        algorithm: "aes-256-cbc",
      })
      @Field("string")
      declare body: string;
    }
    const m1 = new Message();
    const m2 = new Message();

    m1.body = "secret";
    m2.body = "secret";

    expect(m1.body).to.equal("secret");
    expect(m2.body).to.equal("secret");
    expect(m1).to.not.deep.equal(m2);
  });
  it("preserves data integrity", async () => {
    class Complex extends Table.with(EncryptionModifier) {
      @Encrypted({
        secretKey: "12345678901234567890123456789012",
        algorithm: "aes-256-cbc",
      })
      @Field("any")
      declare payload: {
        string: string;
        number: number;
        boolean: boolean;
        null: null;
        array: number[];
        object: { nested: string };
        date: Date;
      };
    }

    const original = {
      string: "txt",
      number: 123,
      boolean: true,
      null: null,
      array: [1, 2],
      object: { nested: "val" },
      date: new Date("2022-12-01"),
    };

    const instance = new Complex();
    instance.payload = original;
    expect(instance.payload).to.deep.equal(original);
    expect(instance.payload.date).to.be.instanceOf(Date);
  });
});
