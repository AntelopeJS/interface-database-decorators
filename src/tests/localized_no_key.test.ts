import { expect } from "chai";
import { Schema } from "@antelopejs/interface-database";
import { RegisterTable } from "../schema";
import { RegisterSchema } from "../database";
import { Field, Table } from "../table";
import { fromDatabase, lock, unlock } from "../modifiers/common";
import { EncryptionModifier, Encrypted } from "../modifiers/encryption";
import { LocalizationModifier, Localized } from "../modifiers/localization";

describe("Localized fields - a request without a locale", () => {
  @RegisterTable("no-key-pages", "localized-no-key-schema")
  class Page extends Table.with(LocalizationModifier, EncryptionModifier) {
    @Localized() @Field("string") declare title?: string;
    @Localized({ fallbackLocale: "en" })
    @Field("string")
    declare summary?: string;
    @Localized()
    @Encrypted({ secretKey: "12345678901234567890123456789012" })
    @Field("string")
    declare secret?: string;
  }

  async function createdWithoutLocale() {
    await RegisterSchema("localized-no-key-schema");
    const instance = Schema.get("localized-no-key-schema")?.instance();
    if (!instance) throw new Error("Database not found");
    const row = new Page();
    row._id = "page-1";
    row.title = undefined;
    row.summary = undefined;
    row.secret = "Sent without a locale";
    lock(row, LocalizationModifier, undefined, undefined);
    await Page.table(instance).insert(row).run();
    const read = fromDatabase(
      await Page.table(instance).get("page-1").run(),
      Page,
    );
    unlock(read, LocalizationModifier, undefined, undefined);
    return read;
  }

  afterEach(async () => {
    await Schema.get("localized-no-key-schema")
      ?.instance()
      .table("no-key-pages")
      .delete()
      .run();
  });

  it("answers null for a field the request did not send", async () => {
    const answer: unknown = JSON.parse(
      JSON.stringify(await createdWithoutLocale()),
    );

    expect(answer).to.deep.include({
      title: null,
      summary: null,
      secret: null,
    });
  });
});
