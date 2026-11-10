import { expect } from "chai";
import { Field, Table } from "../../table";
import { fromDatabase, toDatabase } from "../../modifiers/common";
import { Hashed, HashModifier } from "../../modifiers/hash";
import { Localized, LocalizationModifier } from "../../modifiers/localization";
import { PASSWORD, scryptSuite } from "../helpers/hash-rows";

const WRONG_PASSWORD = "not the password";
const CURRENT_FORMAT =
  /^\$scrypt\$ln=15,r=8,p=3\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;

class Account extends Table.with(HashModifier) {
  declare _id: string;

  @Hashed()
  @Field("string")
  declare password?: string;

  @Hashed({ algorithm: "sha256" })
  @Field("string")
  declare fingerprint: string;

  @Field("string")
  declare email: string;
}

function storedPassword(account: Account) {
  return toDatabase(account)._internal?.data.password;
}

function reloaded(account: Account) {
  return fromDatabase(structuredClone(toDatabase(account)), Account);
}

async function expectTests(account: Account, password: string) {
  const pending = account.testHashAsync("password", password);
  const matches = account.testHash("password", password);
  expect(await pending).to.equal(matches);
  return matches;
}

/** The longest gap between two timer ticks while `work` runs, in ms. */
async function longestStallMs(work: () => Promise<void>) {
  let last = performance.now();
  let longest = 0;
  let ticking = true;
  const tick = () => {
    const now = performance.now();
    longest = Math.max(longest, now - last);
    last = now;
    if (ticking) setTimeout(tick, 1);
  };
  setTimeout(tick, 1);
  await work();
  await new Promise((resolve) => setTimeout(resolve, 5));
  ticking = false;
  return longest;
}

scryptSuite("Modifiers - hash - setHashAsync", () => {
  for (const password of [PASSWORD, ""]) {
    it(`keeps timers running while it hashes ${JSON.stringify(password)}, unlike an assignment`, async () => {
      const blocked = await longestStallMs(async () => {
        new Account().password = password;
      });
      const account = new Account();
      const free = await longestStallMs(() =>
        account.setHashAsync("password", password),
      );

      expect(storedPassword(account)).to.match(CURRENT_FORMAT);
      expect(free).to.be.below(blocked / 2);
    });
  }

  it("reads back what an assignment reads on a field another modifier holds floating", async () => {
    class Content extends Table.with(HashModifier, LocalizationModifier) {
      declare title: string;
    }
    Localized()(Content.prototype, "title");
    Hashed()(Content.prototype, "title");
    const assigned = new Content();
    assigned.title = PASSWORD;
    const awaited = new Content();
    await awaited.setHashAsync("title", PASSWORD);

    expect(awaited.title).to.equal(assigned.title);
    expect(JSON.stringify(awaited)).to.equal(JSON.stringify(assigned));
  });

  it("stores a hash that verifies the same way as an assigned one", async () => {
    const assigned = new Account();
    assigned.password = PASSWORD;
    const awaited = new Account();
    await awaited.setHashAsync("password", PASSWORD);

    for (const account of [assigned, awaited].map(reloaded)) {
      expect(storedPassword(account)).to.match(CURRENT_FORMAT);
      expect(account.isHashOutdated("password")).to.equal(false);
      expect(await expectTests(account, PASSWORD)).to.equal(true);
      expect(await expectTests(account, WRONG_PASSWORD)).to.equal(false);
    }
    expect(storedPassword(awaited)).to.not.equal(storedPassword(assigned));
  });

  it("replaces a stored hash and keeps it when given that hash back", async () => {
    const account = new Account();
    account.password = WRONG_PASSWORD;
    await account.setHashAsync("password", PASSWORD);
    const stored = storedPassword(account);
    expect(await expectTests(account, PASSWORD)).to.equal(true);

    await account.setHashAsync("password", account.password);
    expect(storedPassword(account)).to.equal(stored);
  });

  it("clears the field when given undefined, like an assignment", async () => {
    const account = new Account();
    await account.setHashAsync("password", PASSWORD);
    await account.setHashAsync("password", undefined);
    expect(storedPassword(account)).to.equal(undefined);
  });

  it("stores the digest an assignment stores on a field with an algorithm", async () => {
    const account = new Account();
    account.fingerprint = "first";
    await account.setHashAsync("fingerprint", "second");
    const viaAsync = toDatabase(account)._internal?.data.fingerprint;
    account.fingerprint = "second";
    expect(viaAsync).to.equal(toDatabase(account)._internal?.data.fingerprint);
  });

  it("rejects a field that is not hashed", async () => {
    const error = await new Account()
      .setHashAsync("email", "a@example.test")
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );
    expect(error)
      .to.be.an("error")
      .with.property("message", "Field email is not hashed");
  });
});
