import { expect } from "chai";
import { Schema } from "@antelopejs/interface-database";
import { RegisterSchema } from "../database";
import { BasicDataModel } from "../model";
import { UpdateTime } from "../modifiers/autodate";
import { Encrypted, EncryptionModifier } from "../modifiers/encryption";
import { RegisterTable } from "../schema";
import { Field, Table } from "../table";

const SCHEMA_ID = "partial-update-schema";

@RegisterTable("partial_update_notes", SCHEMA_ID)
class Note extends Table.with(EncryptionModifier) {
  @Field("string")
  declare title: string;

  @UpdateTime()
  @Field("date")
  declare updatedAt: Date;

  @Encrypted({ secretKey: "0123456789abcdef0123456789abcdef" })
  @Field("string")
  declare secret: string;
}

const NoteModel = BasicDataModel(Note, "partial_update_notes");

describe("Integration - partial update", () => {
  it("keeps modifier data on an update of another field", async () => {
    await RegisterSchema(SCHEMA_ID);
    const instance = Schema.get(SCHEMA_ID)?.instance();
    if (!instance) throw new Error("Partial update schema not found");
    const model = new NoteModel(instance);
    const [id] = await model.insert({ title: "First", secret: "kept" });

    await model.update(id, { title: "Second" });

    const note = await model.get(id);
    expect(note?.title).to.equal("Second");
    expect(note?.secret).to.equal("kept");
  });
});
