import { expect } from "chai";
import { Schema, ValueProxy } from "@antelopejs/interface-database";
import { RegisterTable } from "../schema";
import { RegisterSchema } from "../database";
import { BasicDataModel } from "../model";
import { Table } from "../table";
import { LocalizationModifier, Localized } from "../modifiers/localization";
import { unlockrequest } from "../modifiers/common";

describe("Localized queries - keys a controller hands over", () => {
  @RegisterTable("titles", "localized-query-keys-schema")
  class Title extends Table.with(LocalizationModifier) {
    @Localized({ fallbackLocale: "en" })
    declare title: string;
  }

  async function titlesFor(key: string | ValueProxy<string> | undefined) {
    await RegisterSchema("localized-query-keys-schema");
    const instance = Schema.get("localized-query-keys-schema")?.instance();
    if (!instance) throw new Error("Database not found");
    const row = new Title();
    row._id = "title-1";
    row.localize("en").title = "English";
    row.localize("fr").title = "French";
    await new (BasicDataModel(Title, "titles"))(instance).insert(row);
    return Title.table(instance)
      .filter((stored) => stored.key("_id").eq("title-1"))
      .map((stored) =>
        unlockrequest(Title, stored, "title", [
          { modifier: LocalizationModifier, args: [key] },
        ]),
      )
      .run();
  }

  afterEach(async () => {
    await Schema.get("localized-query-keys-schema")
      ?.instance()
      .table("titles")
      .delete()
      .run();
  });

  it("answers the fallback locale for no key", async () => {
    expect(await titlesFor(undefined)).to.deep.equal(["English"]);
  });

  it("answers the locale of a constant proxy key", async () => {
    expect(await titlesFor(ValueProxy.constant("fr"))).to.deep.equal([
      "French",
    ]);
  });
});
