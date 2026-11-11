import { expect } from "chai";
import { Schema } from "@antelopejs/interface-database";
import { RegisterTable } from "../schema";
import { RegisterSchema } from "../database";
import { BasicDataModel } from "../model";
import { Table } from "../table";
import { Encrypted, EncryptionModifier } from "../modifiers/encryption";
import { LocalizationModifier, Localized } from "../modifiers/localization";
import { getInternal } from "../modifiers/internal/records";

describe("Localized fields - plain data with values by locale", () => {
  @RegisterTable("roles", "localized-plain-data-schema")
  class Role extends Table.with(LocalizationModifier, EncryptionModifier) {
    @Localized() declare displayName?: string;
    @Localized() declare tooltip?: string | null;
    @Localized()
    @Encrypted({ secretKey: "12345678901234567890123456789012" })
    declare note?: unknown;
  }

  const RoleModel = BasicDataModel(Role, "roles");
  const wording = { en: "Members", fr: "Membres" };

  async function model() {
    await RegisterSchema("localized-plain-data-schema");
    const instance = Schema.get("localized-plain-data-schema")?.instance();
    if (!instance) throw new Error("Database not found");
    return new RoleModel(instance);
  }

  async function stored(row: Role) {
    const roles = await model();
    row._id = "role-1";
    await roles.insert(row);
    const read = await roles.get("role-1");
    if (!read) throw new Error("Row not stored");
    return read;
  }

  afterEach(async () => {
    await Schema.get("localized-plain-data-schema")
      ?.instance()
      .table("roles")
      .delete()
      .run();
  });

  it("stores every locale of a record read under one locale", async () => {
    const read = await stored(
      RoleModel.fromPlainData({ displayName: wording }).localize("en"),
    );

    expect(getInternal(read).data.displayName).to.deep.equal(wording);
    expect(read.localize("en").displayName).to.equal("Members");
  });

  it("stores every locale of a record read with no locale", async () => {
    const read = await stored(
      RoleModel.fromPlainData({ displayName: wording }),
    );

    expect(getInternal(read).data.displayName).to.deep.equal(wording);
  });

  it("stores a plain value under the locale it is read with", async () => {
    const read = await stored(
      RoleModel.fromPlainData({ displayName: "Members" }).localize("en"),
    );

    expect(getInternal(read).data.displayName).to.deep.equal({ en: "Members" });
  });

  it("stores a null value under the locale it is read with", async () => {
    const read = await stored(
      RoleModel.fromPlainData({ displayName: wording, tooltip: null }).localize(
        "en",
      ),
    );

    expect(getInternal(read).data.tooltip).to.deep.equal({ en: null });
  });

  it("stores no record for a field encrypted inside its locales", async () => {
    const read = await stored(RoleModel.fromPlainData({ note: wording }));

    expect(getInternal(read).data.note).to.equal(undefined);
  });
});
