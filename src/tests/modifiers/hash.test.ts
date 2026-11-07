import { createHash, scryptSync } from "node:crypto";
import { expect } from "chai";
import { Field, Table } from "../../table";
import { fromDatabase, lock } from "../../modifiers/common";
import { Hashed, HashModifier } from "../../modifiers/hash";
import {
  FINGERPRINT_ROW_FROM_0_1_11,
  PASSWORD,
  ROW_FROM_0_1_11,
  scryptSuite,
} from "../helpers/hash-rows";

const WRONG_PASSWORD = "not the password";
const SALT = "c2FsdHNhbHRzYWx0c2FsdA";
const KEY = "a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2V5a2U";

class Account extends Table.with(HashModifier) {
  declare _id: string;

  @Hashed()
  @Field("string")
  declare password: string;

  @Field("string")
  declare email: string;
}

class Fingerprint extends Table.with(HashModifier) {
  @Hashed({ algorithm: "sha256" })
  @Field("string")
  declare password: string;

  @Hashed({ algorithm: "md5" })
  @Field("any")
  declare checksum: { a: number };
}

type StoredValue = string | number | null | undefined;

type StoredRow = {
  _internal: {
    meta: { HashModifier?: { salt: string } };
    data: { password?: StoredValue; checksum?: string };
  };
};

function accountFrom(row: StoredRow) {
  return fromDatabase(structuredClone(row), Account);
}

function accountStoring(stored: StoredValue) {
  return accountFrom({ _internal: { meta: {}, data: { password: stored } } });
}

function newAccount(password = PASSWORD) {
  const account = new Account();
  account.password = password;
  return account;
}

function scryptRow(ln: number, password = PASSWORD) {
  const salt = Buffer.alloc(16, 7);
  const key = scryptSync(JSON.stringify(password), salt, 32, {
    N: 2 ** ln,
    r: 8,
    p: 1,
    maxmem: 2 ** 30,
  });
  const encoded = [salt, key].map((part) =>
    part.toString("base64").replace(/=+$/, ""),
  );
  return `$scrypt$ln=${ln},r=8,p=1$${encoded[0]}$${encoded[1]}`;
}

/** Starts the async test before the sync one, so their scrypt runs overlap. */
async function expectTests(
  account: Account,
  password: string,
  expected: boolean,
) {
  const pending = account.testHashAsync("password", password);
  expect(account.testHash("password", password)).to.equal(expected);
  expect(await pending).to.equal(expected);
}

async function expectVerifies(account: Account, password = PASSWORD) {
  await expectTests(account, password, true);
}

async function expectRefuses(account: Account, password = WRONG_PASSWORD) {
  await expectTests(account, password, false);
}

function fastestMs(work: () => void) {
  const runs = [0, 1, 2].map(() => {
    const started = performance.now();
    work();
    return performance.now() - started;
  });
  return Math.min(...runs);
}

describe("Modifiers - hash", () => {
  it("hashes string values", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const originalValue = "password123";
    const hashed = modifier.lock(undefined, originalValue);

    expect(hashed).to.be.a("string");
    expect(hashed).to.not.equal(originalValue);
    expect(modifier.getMeta().salt).to.be.a("string");
  });
  it("hashes object values", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const originalValue = { name: "John", age: 30 };
    const hashed = modifier.lock(undefined, originalValue);

    expect(hashed).to.be.a("string");
    expect(hashed).to.not.equal(JSON.stringify(originalValue));
  });
  it("handles undefined values", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const hashed = modifier.lock(undefined, undefined);

    expect(hashed).to.equal(undefined);
  });
  it("uses custom hash algorithm", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "md5" });
    modifier.setMeta({});

    const originalValue = "test data";
    const hashed = modifier.lock(undefined, originalValue);

    expect(hashed).to.be.a("string");
    expect(hashed).to.not.equal(originalValue);
    expect(modifier.getOptions().algorithm).to.equal("md5");
  });
  it("generates unique salt for each field", async () => {
    const modifier1 = new TestableHashModifier();
    modifier1.setOptions({ algorithm: "sha256" });
    modifier1.setMeta({});

    const modifier2 = new TestableHashModifier();
    modifier2.setOptions({ algorithm: "sha256" });
    modifier2.setMeta({});

    const value = "test data";
    const hashed1 = modifier1.lock(undefined, value);
    const hashed2 = modifier2.lock(undefined, value);

    expect(hashed1).to.not.equal(hashed2);
    expect(modifier1.getMeta().salt).to.not.equal(modifier2.getMeta().salt);
  });
  it("handles hash decorator", async () => {
    class TestTable extends Table.with(HashModifier) {
      @Hashed({ algorithm: "sha256" })
      @Field("string")
      declare password: string;
    }

    const instance = new TestTable();
    instance.password = "myPassword123";

    expect(instance.testHash("password", "myPassword123")).to.equal(true);
    expect(instance.testHash("password", "notMyPassword")).to.equal(false);
  });
  it("tests hash values correctly", async () => {
    const modifier = new TestableHashModifier();
    modifier.setOptions({ algorithm: "sha256" });
    modifier.setMeta({});

    const originalValue = "test data";
    const hashed = modifier.lock(undefined, originalValue);

    const isMatch = modifier.test(hashed, originalValue);
    const isNotMatch = modifier.test(hashed, "wrong data");

    expect(isMatch).to.equal(true);
    expect(isNotMatch).to.equal(false);
  });
  it("provides testHash method through mixin", async () => {
    class TestTable extends Table.with(HashModifier) {
      @Hashed({ algorithm: "sha256" })
      @Field("string")
      declare password: string;
    }

    const instance = new TestTable();
    instance.password = "myPassword123";

    expect(instance).to.have.property("testHash").that.is.a("function");

    const isMatch = instance.testHash("password", "myPassword123");
    const isNotMatch = instance.testHash("password", "wrongPassword");

    expect(isMatch).to.equal(true);
    expect(isNotMatch).to.equal(false);
  });
});

scryptSuite("Modifiers - hash, default scrypt format", () => {
  it("stores a string that describes the hash it holds, at N >= 2^15", () => {
    const stored = newAccount().password;

    const match = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(
      stored,
    );
    if (!match) throw new Error(`Unexpected stored form: ${stored}`);
    const [ln, r, p] = match.slice(1, 4).map(Number);
    expect(ln).to.be.at.least(15);
    const key = scryptSync(
      JSON.stringify(PASSWORD),
      Buffer.from(match[4], "base64"),
      Buffer.from(match[5], "base64").length,
      { N: 2 ** ln, r, p, maxmem: 2 ** 30 },
    );
    expect(key.toString("base64").replace(/=+$/, "")).to.equal(match[5]);
  });

  it("gives each write its own salt", () => {
    expect(newAccount().password).to.not.equal(newAccount().password);
  });

  it("tests a value against the stored hash, sync and async", async () => {
    const account = newAccount();
    await expectVerifies(account);
    await expectRefuses(account);
  });

  it("does not flag a hash it just wrote", () => {
    expect(newAccount().isHashOutdated("password")).to.equal(false);
  });

  it("does not flag a field with nothing stored", () => {
    expect(new Account().isHashOutdated("password")).to.equal(false);
  });

  it("throws when asked about a field that is not hashed", async () => {
    const account = newAccount();
    expect(() => account.isHashOutdated("email")).to.throw("email");
    let failure: unknown;
    await account.testHashAsync("email", PASSWORD).catch((error: unknown) => {
      failure = error;
    });
    expect(failure).to.be.instanceOf(Error);
  });
});

scryptSuite("Modifiers - hash, upgrade of stored hashes", () => {
  it("verifies a row written by 0.1.11 and flags it", async () => {
    const account = accountFrom(ROW_FROM_0_1_11);
    await expectVerifies(account);
    await expectRefuses(account);
    expect(account.isHashOutdated("password")).to.equal(true);
  });

  it("after a re-hash, verifies and no longer flags that row", async () => {
    const account = accountFrom(ROW_FROM_0_1_11);
    account.password = PASSWORD;
    expect(account.password).to.match(/^\$scrypt\$/);
    await expectVerifies(account);
    await expectRefuses(account);
    expect(account.isHashOutdated("password")).to.equal(false);
  });

  it("verifies a hash of a lower cost by its own parameters and flags it", async () => {
    const account = accountStoring(scryptRow(14));
    await expectVerifies(account);
    await expectRefuses(account);
    expect(account.isHashOutdated("password")).to.equal(true);
  });

  it("keeps the salt of each row while two async tests overlap", async () => {
    const first = accountFrom(ROW_FROM_0_1_11);
    const second = accountFrom({
      _internal: {
        meta: { HashModifier: { salt: "another-salt" } },
        data: {
          password: createHash("sha256")
            .update("another-salt")
            .update(JSON.stringify(WRONG_PASSWORD))
            .digest("base64"),
        },
      },
    });
    const results = await Promise.all([
      first.testHashAsync("password", PASSWORD),
      second.testHashAsync("password", WRONG_PASSWORD),
      first.testHashAsync("password", WRONG_PASSWORD),
      second.testHashAsync("password", PASSWORD),
    ]);
    expect(results).to.deep.equal([true, true, false, false]);
  });
});

scryptSuite("Modifiers - hash, assigning the stored hash back", () => {
  const rows = {
    "from 0.1.11": () => accountFrom(ROW_FROM_0_1_11),
    current: () => newAccount(),
  };
  for (const [name, build] of Object.entries(rows)) {
    it(`lock() on a ${name} row keeps the hash`, async () => {
      const account = build();
      const stored = account.password;
      lock(account, HashModifier, undefined);
      lock(account, HashModifier, ["password"]);
      expect(account.password).to.equal(stored);
      await expectVerifies(account);
    });

    it(`assigning the hash of a ${name} row keeps it`, async () => {
      const account = build();
      const stored = account.password;
      account.password = stored;
      expect(account.password).to.equal(stored);
      await expectVerifies(account);
    });
  }
});

scryptSuite("Modifiers - hash, explicit algorithm", () => {
  function fingerprintFrom(row: StoredRow) {
    return fromDatabase(structuredClone(row), Fingerprint);
  }

  it("still verifies rows written by 0.1.11 and never flags them", async () => {
    const row = fingerprintFrom(FINGERPRINT_ROW_FROM_0_1_11);
    expect(row.testHash("password", PASSWORD)).to.equal(true);
    expect(await row.testHashAsync("password", PASSWORD)).to.equal(true);
    expect(row.testHash("password", WRONG_PASSWORD)).to.equal(false);
    expect(row.testHash("checksum", { a: 1 })).to.equal(true);
    expect(row.testHash("checksum", { a: 2 })).to.equal(false);
    expect(row.isHashOutdated("password")).to.equal(false);
    expect(row.isHashOutdated("checksum")).to.equal(false);
  });

  it("still writes the same salted digest as 0.1.11", () => {
    const row = fingerprintFrom(FINGERPRINT_ROW_FROM_0_1_11);
    row.password = "another value";
    expect(row.password).to.equal(
      createHash("sha256")
        .update(FINGERPRINT_ROW_FROM_0_1_11._internal.meta.HashModifier.salt)
        .update(JSON.stringify("another value"))
        .digest("base64"),
    );
  });

  it("verifies a scrypt hash and does not flag it, so it is not weakened", async () => {
    const row = fromDatabase(
      { _internal: { meta: {}, data: { password: scryptRow(15) } } },
      Fingerprint,
    );
    expect(await row.testHashAsync("password", PASSWORD)).to.equal(true);
    expect(row.testHash("password", WRONG_PASSWORD)).to.equal(false);
    expect(row.isHashOutdated("password")).to.equal(false);
  });
});

scryptSuite("Modifiers - hash, values that cannot verify", () => {
  const unusable: [string, StoredValue][] = [
    ["no value", undefined],
    ["a null value", null],
    ["a number", 42],
    ["a digest with no salt", "nPamXXaKC8N+8W7xqxTSo8r+pS9jXMkjJu2XMZtUR+A="],
    ["a bare prefix", "$scrypt$"],
    ["a key too short to compare", `$scrypt$ln=15,r=8,p=1$${SALT}$A`],
    ["an empty key", `$scrypt$ln=15,r=8,p=1$${SALT}$`],
    ["a salt too short", `$scrypt$ln=15,r=8,p=1$AAAA$${KEY}`],
    ["a cost over the memory limit", `$scrypt$ln=30,r=8,p=1$${SALT}$${KEY}`],
    ["a zero p", `$scrypt$ln=15,r=8,p=0$${SALT}$${KEY}`],
    ["a zero r", `$scrypt$ln=15,r=0,p=1$${SALT}$${KEY}`],
    ["a zero ln", `$scrypt$ln=0,r=8,p=1$${SALT}$${KEY}`],
    ["an N that r cannot hold", `$scrypt$ln=16,r=1,p=1$${SALT}$${KEY}`],
  ];
  for (const [name, stored] of unusable) {
    it(`refuses a row storing ${name} without throwing`, async () => {
      await expectRefuses(accountStoring(stored), PASSWORD);
    });
  }

  it("refuses an undefined candidate on a row with nothing stored", async () => {
    await expectRefuses(new Account(), new Account().email);
  });

  it("refuses an undefined candidate on a row with a hash", async () => {
    await expectRefuses(newAccount(), new Account().email);
  });
});

scryptSuite("Modifiers - hash, limits of a stored string", () => {
  function rowFor({ ln = 1, r = 1, p = 1, saltBytes = 16, keyBytes = 32 }) {
    const salt = Buffer.alloc(saltBytes, 7);
    const key = scryptSync(JSON.stringify(PASSWORD), salt, keyBytes, {
      N: 2 ** ln,
      r,
      p,
      maxmem: 2 ** 30,
    });
    const [encodedSalt, encodedKey] = [salt, key].map((part) =>
      part.toString("base64").replace(/=+$/, ""),
    );
    return `$scrypt$ln=${ln},r=${r},p=${p}$${encodedSalt}$${encodedKey}`;
  }

  const overLimit = [
    { name: "a p of 17", cost: { p: 17 } },
    { name: "an r of 100", cost: { r: 100 } },
    { name: "memory above 128 MiB", cost: { ln: 17, r: 9 } },
    { name: "a salt of 65 bytes", cost: { saltBytes: 65 } },
    { name: "a salt of 15 bytes", cost: { saltBytes: 15 } },
    { name: "a key of 65 bytes", cost: { keyBytes: 65 } },
    { name: "a key of 15 bytes", cost: { keyBytes: 15 } },
  ];
  for (const { name, cost } of overLimit) {
    it(`refuses the right password on a row asking for ${name}`, async () => {
      const account = accountStoring(rowFor(cost));
      await expectRefuses(account, PASSWORD);
      expect(account.isHashOutdated("password")).to.equal(true);
    });
  }

  const atLimit = [
    { name: "a p of 16", cost: { p: 16 } },
    { name: "128 MiB of memory", cost: { ln: 17, r: 8 } },
    { name: "64-byte salt and key", cost: { saltBytes: 64, keyBytes: 64 } },
  ];
  for (const { name, cost } of atLimit) {
    it(`verifies the right password on a row asking for ${name}`, () => {
      const account = accountStoring(rowFor(cost));
      expect(account.testHash("password", PASSWORD)).to.equal(true);
    });
  }
});

scryptSuite("Modifiers - hash, cost of a test", () => {
  it("testHashAsync lets the event loop turn while it runs", async () => {
    const account = newAccount();
    let turns = 0;
    const timer = setInterval(() => {
      turns += 1;
    }, 1);
    await account.testHashAsync("password", PASSWORD);
    clearInterval(timer);
    expect(turns).to.be.greaterThan(0);
  });

  it("a refusal costs a scrypt run whatever the row holds", () => {
    const current = newAccount();
    const legacy = accountFrom(ROW_FROM_0_1_11);
    const empty = new Account();
    const full = fastestMs(() => current.testHash("password", WRONG_PASSWORD));

    for (const account of [legacy, empty]) {
      const refused = fastestMs(() =>
        account.testHash("password", WRONG_PASSWORD),
      );
      expect(refused).to.be.greaterThan(full / 4);
    }
  });

  it("a field with an explicit digest does not pay for scrypt", () => {
    const row = new Fingerprint();
    row.password = PASSWORD;
    const digest = fastestMs(() => row.testHash("password", WRONG_PASSWORD));
    const current = newAccount();
    const full = fastestMs(() => current.testHash("password", WRONG_PASSWORD));
    expect(digest).to.be.lessThan(full / 4);
  });
});

interface HashOptions {
  algorithm?: string;
}

interface HashMeta {
  salt?: string;
}

class TestableHashModifier extends HashModifier {
  public setOptions(options: HashOptions) {
    this.options = options;
  }

  public getOptions(): HashOptions {
    return this.options;
  }

  public getMeta(): HashMeta {
    return this.meta;
  }

  public setMeta(meta: HashMeta) {
    this.meta = meta;
  }
}
