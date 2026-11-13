import { expect } from "chai";
import { Field, Table } from "../../table";
import { Encrypted, EncryptionModifier } from "../../modifiers/encryption";
import { Hashed, HashModifier } from "../../modifiers/hash";
import { Localized, LocalizationModifier } from "../../modifiers/localization";
import type { WriteValue } from "@antelopejs/interface-database/common";
import {
  attachModifier,
  fromDatabase,
  fromPlainData,
  testValue,
  toDatabase,
  TwoWayModifier,
} from "../../modifiers/common";

const secretKey = "12345678901234567890123456789012";

describe("Modifiers - testValue", () => {
  it("compares a value with an encrypted field", () => {
    class Vault extends Table.with(EncryptionModifier) {
      @Encrypted({ secretKey })
      @Field("string")
      declare secret: string;
    }
    const vault = new Vault();
    vault.secret = "right";

    expect(testValue(vault, "secret", "right")).to.equal(true);
    expect(testValue(vault, "secret", "wrong")).to.equal(false);
  });
  it("compares a value with the selected locale of a localized field", () => {
    class Page extends Table.with(LocalizationModifier) {
      @Localized()
      @Field("string")
      declare title: string;
    }
    const page = fromPlainData({}, Page).localize("en");
    page.title = "Hello";

    expect(testValue(page, "title", "Hello")).to.equal(true);
    expect(testValue(page, "title", "Bonjour")).to.equal(false);
  });
  it("compares a value through every modifier of a field", () => {
    class Note extends Table.with(LocalizationModifier, EncryptionModifier) {
      @Localized()
      @Encrypted({ secretKey })
      @Field("string")
      declare body: string;
    }
    const note = fromPlainData({}, Note).localize("en");
    note.body = "Hello";

    expect(testValue(note, "body", "Hello")).to.equal(true);
    expect(testValue(note, "body", "Bonjour")).to.equal(false);
  });
  it("matches a localized field with no text against null", () => {
    class Page extends Table.with(LocalizationModifier) {
      @Localized()
      @Field("string")
      declare title?: string | null;
    }
    const page = fromPlainData({}, Page).localize("en");
    page.title = "Hello";
    page.localize("de");

    expect(testValue(page, "title", null)).to.equal(true);
    expect(testValue(page, "title", undefined)).to.equal(false);
    expect(testValue(page, "title", "Hello")).to.equal(false);
  });
  it("answers false for a field whose locale is not selected yet", () => {
    class Page extends Table.with(LocalizationModifier) {
      @Localized()
      @Field("string")
      declare title?: string;
    }
    const stored = fromDatabase(
      toDatabase(fromPlainData({ title: { en: "Hello" } }, Page)),
      Page,
    );

    expect(testValue(stored, "title", undefined)).to.equal(false);
  });
  it("compares a value assigned before its locale is selected", () => {
    class Page extends Table.with(LocalizationModifier) {
      @Localized()
      @Field("string")
      declare title: string;
    }
    const page = fromPlainData({}, Page);
    page.title = "Hello";

    expect(testValue(page, "title", "Hello")).to.equal(true);
    expect(testValue(page, "title", "Bonjour")).to.equal(false);
  });
  it("tests a value against a hashed field", () => {
    class Account extends Table.with(HashModifier) {
      @Hashed({ algorithm: "sha256" })
      @Field("string")
      declare password: string;
    }
    const account = new Account();
    account.password = "right";

    expect(testValue(account, "password", "right")).to.equal(true);
    expect(testValue(account, "password", "wrong")).to.equal(false);
  });
  it("compares what a field reads through a modifier that only unlocks by itself", () => {
    class Prefix extends TwoWayModifier<string> {
      public readonly autounlock = true;
      public override lock(_locked: string | undefined, value: WriteValue) {
        return `L:${JSON.stringify(value)}`;
      }
      public override unlock(locked: string) {
        return locked.slice(2);
      }
    }
    class Note extends Table {
      @Field("string")
      declare body: string;
    }
    attachModifier(Note, Prefix, "body", {});
    const note = fromDatabase(
      { _id: "n", _internal: { meta: {}, data: { body: "L:x" } } },
      Note,
    );

    expect(testValue(note, "body", "x")).to.equal(true);
    expect(testValue(note, "body", "L:x")).to.equal(false);
  });
  it("compares a field with no modifier", () => {
    class Note extends Table {
      @Field("string")
      declare body: string;
    }
    const note = fromPlainData({ body: "Hello" }, Note);

    expect(testValue(note, "body", "Hello")).to.equal(true);
    expect(testValue(note, "body", "Bonjour")).to.equal(false);
  });
});
