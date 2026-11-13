import { expect } from "chai";
import { Field, Table } from "../../table";
import { Encrypted, EncryptionModifier } from "../../modifiers/encryption";
import { Localized, LocalizationModifier } from "../../modifiers/localization";
import { fromPlainData, testValue } from "../../modifiers/common";

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
});
