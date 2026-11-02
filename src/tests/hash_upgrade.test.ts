import { expect } from "chai";
import { Schema } from "@antelopejs/interface-database";
import { RegisterSchema } from "../database";
import { BasicDataModel } from "../model";
import { UpdateTime } from "../modifiers/autodate";
import { lock } from "../modifiers/common";
import { Hashed, HashModifier } from "../modifiers/hash";
import { RegisterTable } from "../schema";
import { Field, Table } from "../table";
import { PASSWORD, ROW_FROM_0_1_11, scryptSuite } from "./helpers/hash-rows";

const SCHEMA_ID = "hash-upgrade-schema";
const WRONG_PASSWORD = "not the password";

@RegisterTable("hash_upgrade_accounts", SCHEMA_ID)
class Account extends Table.with(HashModifier) {
  declare _id: string;

  @Field("string")
  declare name: string;

  @UpdateTime()
  @Field("date")
  declare updatedAt: Date;

  @Hashed()
  @Field("string")
  declare password: string;
}

const AccountModel = BasicDataModel(Account, "hash_upgrade_accounts");

scryptSuite("Integration - upgrade of stored hashes", () => {
  let model: InstanceType<typeof AccountModel>;

  before(async () => {
    await RegisterSchema(SCHEMA_ID);
    const instance = Schema.get(SCHEMA_ID)?.instance();
    if (!instance) throw new Error("Hash upgrade schema not found");
    model = new AccountModel(instance);
  });

  async function storedRowFrom0_1_11() {
    const _id = `from-0.1.11-${Math.random()}`;
    await model.table
      .insert(structuredClone({ ...ROW_FROM_0_1_11, _id }))
      .run();
    return _id;
  }

  async function storedCurrentRow() {
    const [id] = await model.insert({ name: "Current", password: PASSWORD });
    return id;
  }

  async function reload(id: string) {
    const account = await model.get(id);
    if (!account) throw new Error(`Row ${id} not found`);
    return account;
  }

  async function expectVerifies(account: Account) {
    expect(account.testHash("password", PASSWORD)).to.equal(true);
    expect(await account.testHashAsync("password", PASSWORD)).to.equal(true);
    expect(account.testHash("password", WRONG_PASSWORD)).to.equal(false);
    expect(await account.testHashAsync("password", WRONG_PASSWORD)).to.equal(
      false,
    );
  }

  it("verifies, flags, re-hashes and saves a row written by 0.1.11", async () => {
    const id = await storedRowFrom0_1_11();
    const before = await reload(id);
    await expectVerifies(before);
    expect(before.isHashOutdated("password")).to.equal(true);

    before.password = PASSWORD;
    await model.update(before);

    const after = await reload(id);
    expect(after.password).to.match(/^\$scrypt\$ln=15,r=8,p=3\$/);
    await expectVerifies(after);
    expect(after.isHashOutdated("password")).to.equal(false);
  });

  it("re-hashes through a partial update of the hashed field", async () => {
    const id = await storedRowFrom0_1_11();

    await model.update(id, { password: PASSWORD });

    const after = await reload(id);
    await expectVerifies(after);
    expect(after.isHashOutdated("password")).to.equal(false);
    expect(after.name).to.equal(ROW_FROM_0_1_11.name);
  });

  for (const [kind, store] of [
    ["from 0.1.11", storedRowFrom0_1_11],
    ["current", storedCurrentRow],
  ] as const) {
    it(`a partial update of another field keeps the hash of a ${kind} row`, async () => {
      const id = await store();
      const stored = (await reload(id)).password;

      await model.update(id, { name: "Renamed" });

      const after = await reload(id);
      expect(after.name).to.equal("Renamed");
      expect(after.password).to.equal(stored);
      await expectVerifies(after);
    });

    it(`a whole-row update of another field keeps the hash of a ${kind} row`, async () => {
      const id = await store();
      const account = await reload(id);
      const stored = account.password;

      account.name = "Renamed";
      await model.update(account);

      const after = await reload(id);
      expect(after.name).to.equal("Renamed");
      expect(after.password).to.equal(stored);
      await expectVerifies(after);
    });

    it(`lock() then a whole-row update keeps the hash of a ${kind} row`, async () => {
      const id = await store();
      const account = await reload(id);
      const stored = account.password;

      lock(account, HashModifier, undefined);
      await model.update(account);

      const after = await reload(id);
      expect(after.password).to.equal(stored);
      await expectVerifies(after);
    });
  }
});
