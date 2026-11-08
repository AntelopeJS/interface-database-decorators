import { expect } from "chai";
import { Schema } from "@antelopejs/interface-database";
import { RegisterSchema } from "../database";
import { BasicDataModel } from "../model";
import { UpdateTime } from "../modifiers/autodate";
import { Encrypted, EncryptionModifier } from "../modifiers/encryption";
import { Hashed, HashModifier } from "../modifiers/hash";
import { getInternal } from "../modifiers/internal/records";
import { RegisterTable } from "../schema";
import { Field, Table } from "../table";

const SCHEMA_ID = "partial-update-schema";
const SECRET_KEY = "0123456789abcdef0123456789abcdef";

@RegisterTable("partial_update_notes", SCHEMA_ID)
class Note extends Table.with(EncryptionModifier) {
  @Field("string")
  declare title: string;

  @UpdateTime()
  @Field("date")
  declare updatedAt: Date;

  @Encrypted({ secretKey: SECRET_KEY })
  @Field("string")
  declare secret: string;

  @Encrypted({ secretKey: SECRET_KEY })
  @Field("string")
  declare other: string;
}

@RegisterTable("partial_update_accounts", SCHEMA_ID)
class Account extends Table.with(HashModifier) {
  declare _id: string;

  @Field("string")
  declare name: string;

  @Hashed({ algorithm: "sha256" })
  @Field("string")
  declare pin: string;

  @Hashed({ algorithm: "sha256" })
  @Field("string")
  declare token: string;
}

const NoteModel = BasicDataModel(Note, "partial_update_notes");
const AccountModel = BasicDataModel(Account, "partial_update_accounts");

async function schemaInstance() {
  await RegisterSchema(SCHEMA_ID);
  const instance = Schema.get(SCHEMA_ID)?.instance();
  if (!instance) throw new Error("Partial update schema not found");
  return instance;
}

describe("Integration - partial update", () => {
  it("keeps modifier data on an update of another field", async () => {
    const model = new NoteModel(await schemaInstance());
    const [id] = await model.insert({ title: "First", secret: "kept" });

    await model.update(id, { title: "Second" });

    const note = await model.get(id);
    expect(note?.title).to.equal("Second");
    expect(note?.secret).to.equal("kept");
  });

  it("keeps the other encrypted field on an update of one", async () => {
    const model = new NoteModel(await schemaInstance());
    const [id] = await model.insert({ secret: "a", other: "kept" });

    await model.update(id, { secret: "b" });

    const note = await model.get(id);
    expect(note?.secret).to.equal("b");
    expect(note?.other).to.equal("kept");
  });

  it("keeps the other hashed field and the salt on an update by id", async () => {
    const model = new AccountModel(await schemaInstance());
    const [id] = await model.insert({ name: "Ann", pin: "1234", token: "abc" });
    const before = await model.get(id);
    if (!before) throw new Error("Inserted account not found");

    await model.update(id, { pin: "9999" });

    const account = await model.get(id);
    if (!account) throw new Error("Updated account not found");
    expect(account.testHash("pin", "9999")).to.equal(true);
    expect(account.testHash("token", "abc")).to.equal(true);
    expect(getInternal(account).meta).to.deep.equal(getInternal(before).meta);
  });

  it("keeps the other hashed field and the salt on an update by row", async () => {
    const model = new AccountModel(await schemaInstance());
    const [id] = await model.insert({ name: "Ann", pin: "1234", token: "abc" });
    const before = await model.get(id);
    if (!before) throw new Error("Inserted account not found");

    await model.update({ _id: id, pin: "9999" });

    const account = await model.get(id);
    if (!account) throw new Error("Updated account not found");
    expect(account.testHash("pin", "9999")).to.equal(true);
    expect(account.testHash("token", "abc")).to.equal(true);
    expect(getInternal(account).meta).to.deep.equal(getInternal(before).meta);
  });

  it("updates no row for an id the table does not hold", async () => {
    const model = new AccountModel(await schemaInstance());

    const count = await model.update("missing-account", { pin: "9999" });

    expect(count).to.equal(0);
    expect(await model.get("missing-account")).to.equal(undefined);
  });
});
