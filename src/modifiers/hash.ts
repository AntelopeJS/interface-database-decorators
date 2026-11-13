import { generate } from "randomstring";
import {
  createHash,
  randomBytes,
  scrypt,
  type ScryptOptions,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";
import type { WriteValue } from "@antelopejs/interface-database/common";

import { getMetadata } from "../common";
import {
  attachModifier,
  MixinSymbol,
  ModifiersStaticMetadata,
  OneWayModifier,
} from "./common";
import {
  dataByKey,
  fieldsByKey,
  getInternal,
  withRef,
} from "./internal/records";
import { isString } from "./internal/kinds";

type Options = {
  /**
   * Digest to store instead of the default scrypt hash (for supported names
   * refer to {@link createHash}). A digest is fast to guess: set this only for
   * non-secret fingerprints, never for credentials.
   */
  algorithm?: string;
};

type HashInput = Parameters<OneWayModifier<string | undefined>["test"]>[1];

type ScryptCost = { ln: number; r: number; p: number };

type ScryptArgs = [
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
];

/** One test of a candidate: the KDF run it spends and what decides the result. */
type HashCheck = {
  run?: ScryptArgs;
  verdict: (derived: Buffer | undefined) => boolean;
};

const SCRYPT_COST: ScryptCost = { ln: 15, r: 8, p: 3 };
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const DECOY_SALT = Buffer.alloc(SALT_BYTES);
const LEGACY_DIGEST = "sha256";

/** Most scrypt memory (128 * N * r bytes) a stored hash may ask for. */
const STORED_MAX_MEMORY = 128 * 1024 * 1024;
const STORED_MAX_P = 16;

const CURRENT_PREFIX = `$scrypt$ln=${SCRYPT_COST.ln},r=${SCRYPT_COST.r},p=${SCRYPT_COST.p}$`;

/** Salt and key take 22 to 86 characters, so 16 to 64 bytes. */
const STORED_SCRYPT =
  /^\$scrypt\$ln=([1-9]\d?),r=([1-9]\d?),p=([1-9]\d?)\$([A-Za-z0-9+/]{22,86})\$([A-Za-z0-9+/]{22,86})$/;

function unpaddedBase64(bytes: Buffer) {
  return bytes.toString("base64").replace(/=+$/, "");
}

function scryptArgs(
  password: string,
  salt: Buffer,
  keylen: number,
  { ln, r, p }: ScryptCost,
): ScryptArgs {
  return [
    password,
    salt,
    keylen,
    { N: 2 ** ln, r, p, maxmem: 2 * STORED_MAX_MEMORY },
  ];
}

function scryptAsync(...[password, salt, keylen, options]: ScryptArgs) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** A new salt and the scrypt arguments that derive the current hash of `candidate` with it. */
function currentScrypt(candidate: string) {
  const salt = randomBytes(SALT_BYTES);
  return {
    salt,
    run: scryptArgs(candidate, salt, KEY_BYTES, SCRYPT_COST),
  };
}

function storedScrypt(salt: Buffer, key: Buffer) {
  return `${CURRENT_PREFIX}${unpaddedBase64(salt)}$${unpaddedBase64(key)}`;
}

/** A stored hash derived ahead of the setter, which `lock` keeps as it is. */
class PrecomputedHash {
  public constructor(public readonly stored: string) {}
}

function parseScrypt(stored: string) {
  const match = STORED_SCRYPT.exec(stored);
  if (!match) return undefined;
  const cost = {
    ln: Number(match[1]),
    r: Number(match[2]),
    p: Number(match[3]),
  };
  if (
    128 * cost.r * 2 ** cost.ln > STORED_MAX_MEMORY ||
    cost.p > STORED_MAX_P ||
    cost.ln >= 16 * cost.r
  ) {
    return undefined;
  }
  return {
    cost,
    salt: Buffer.from(match[4], "base64"),
    key: Buffer.from(match[5], "base64"),
  };
}

function digestOf(algorithm: string, salt: string, candidate: string) {
  return createHash(algorithm).update(salt).update(candidate).digest("base64");
}

function digestMatches(
  stored: string,
  salt: string | undefined,
  algorithm: string,
  candidate: string | undefined,
) {
  if (!salt || candidate === undefined) return false;
  const expected = Buffer.from(stored);
  const actual = Buffer.from(digestOf(algorithm, salt, candidate));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Plans the test of a candidate from what the row holds. A field that uses
 * scrypt spends one scrypt run in every case, so the time of a refusal does not
 * tell a missing or an older hash from a current one.
 */
function planCheck(
  row: { stored: string; salt: string | undefined },
  algorithm: string | undefined,
  candidate: string | undefined,
): HashCheck {
  const hash = parseScrypt(row.stored);
  if (hash && candidate !== undefined) {
    return {
      run: scryptArgs(candidate, hash.salt, hash.key.length, hash.cost),
      verdict: (derived) =>
        derived !== undefined && timingSafeEqual(derived, hash.key),
    };
  }
  const matches = digestMatches(
    row.stored,
    row.salt,
    algorithm ?? LEGACY_DIGEST,
    candidate,
  );
  return {
    run: algorithm
      ? undefined
      : scryptArgs(candidate ?? "", DECOY_SALT, KEY_BYTES, SCRYPT_COST),
    verdict: () => matches,
  };
}

/** A row stores a string or nothing. Anything else cannot match a candidate. */
function storedText(stored: string | undefined) {
  return String(stored ?? "");
}

function withHashedField<R>(
  row: { constructor: Function },
  field: PropertyKey,
  use: (modifier: HashModifier, stored: string, alone: boolean) => R,
) {
  const metaTable = getMetadata(row.constructor, ModifiersStaticMetadata);
  const list = fieldsByKey(metaTable)[field];
  const entry = list?.find(({ modifier }) => modifier instanceof HashModifier);
  if (!entry || !(entry.modifier instanceof HashModifier)) {
    throw new Error(`Field ${String(field)} is not hashed`);
  }
  const internal = getInternal(row);
  const stored: unknown = dataByKey(internal)[field];
  return withRef(
    internal,
    entry.id,
    entry.modifier,
    entry.metaRef,
    (modifier) =>
      use(modifier, isString(stored) ? stored : "", list.length === 1),
  );
}

/**
 * Hash modifier. enables the use of {@link Hashed} on table fields.
 *
 * Hashed fields only contain a hash of the inserted value, by default a scrypt
 * hash in the self-describing form `$scrypt$ln=15,r=8,p=3$<salt>$<key>`.
 * Because of this, you lose the ability to query the information directly.
 * You can test equality using {@link testHash}
 */
export class HashModifier extends OneWayModifier<string | undefined> {
  declare public options: Options;
  declare protected meta: { salt?: string };

  public readonly autolock = true;

  /**
   * Hashes a new value. Assigning the stored hash back keeps it as it is.
   * Blocks the event loop for one scrypt run: a setter and the conversions
   * behind `insert` and `update` are synchronous. `setHashAsync` runs it on
   * the thread pool instead.
   */
  public override lock(locked_value: string | undefined, value: WriteValue) {
    if (value === undefined) {
      return value;
    }
    if (value instanceof PrecomputedHash) {
      return value.stored;
    }
    if (value === locked_value) {
      return locked_value;
    }
    const candidate = JSON.stringify(value);
    const { algorithm } = this.options;
    if (algorithm) {
      if (!this.meta.salt) {
        this.meta.salt = generate();
      }
      return digestOf(algorithm, this.meta.salt, candidate);
    }
    const { salt, run } = currentScrypt(candidate);
    return storedScrypt(salt, scryptSync(...run));
  }

  /**
   * What to assign to the field so that its setter stores the hash of `value`
   * without running scrypt: the scrypt run happens here, on the thread pool.
   * A value the setter handles without scrypt comes back as it is: nothing,
   * the stored hash itself (`locked_value`, empty when nothing is stored), or
   * any value of a field with an `algorithm`.
   */
  private async lockAsync(locked_value: string, value: HashInput) {
    if (
      value === undefined ||
      (locked_value !== "" && value === locked_value) ||
      this.options.algorithm
    ) {
      return value;
    }
    const { salt, run } = currentScrypt(JSON.stringify(value));
    return new PrecomputedHash(storedScrypt(salt, await scryptAsync(...run)));
  }

  public override test(locked_value: string | undefined, value: HashInput) {
    const check = this.plan(storedText(locked_value), value);
    return check.verdict(check.run && scryptSync(...check.run));
  }

  /** {@link test} on the thread pool, without blocking the event loop. */
  public async testAsync(locked_value: string, value: HashInput) {
    const check = this.plan(locked_value, value);
    return check.verdict(check.run && (await scryptAsync(...check.run)));
  }

  /**
   * @returns Whether a stored hash differs from what this field writes today. A
   * field with an explicit `algorithm` never reports one: hashing again would
   * give the same digest, or weaken a scrypt hash.
   */
  public isOutdated(locked_value: string) {
    return (
      !this.options.algorithm &&
      locked_value !== "" &&
      !locked_value.startsWith(CURRENT_PREFIX)
    );
  }

  /** Reads the salt now: `this.meta` is bound to a row only synchronously. */
  private plan(locked_value: string, value: HashInput) {
    return planCheck(
      { stored: locked_value, salt: this.meta.salt },
      this.options.algorithm,
      value === undefined ? undefined : JSON.stringify(value),
    );
  }

  [MixinSymbol] = class {
    /**
     * Test a value against the stored hash. Blocks the event loop for one
     * scrypt run: on a server, prefer {@link testHashAsync}.
     *
     * @param field - Name of the field to test against.
     * @param value - Value to hash and test.
     *
     * @returns Whether the new value is identical to the original or not.
     *
     * @throws Error when `field` has no {@link Hashed} decorator.
     */
    testHash<This extends {}, F extends keyof This>(
      this: This,
      field: F,
      value: This[F] & WriteValue,
    ): boolean {
      return withHashedField(this, field, (modifier, stored) =>
        modifier.test(stored, value),
      );
    }

    /**
     * Test a value against the stored hash on the thread pool.
     *
     * @param field - Name of the field to test against.
     * @param value - Value to hash and test.
     *
     * @returns Whether the new value is identical to the original or not.
     */
    async testHashAsync<This extends {}, F extends keyof This>(
      this: This,
      field: F,
      value: This[F] & WriteValue,
    ) {
      return withHashedField(this, field, (modifier, stored) =>
        modifier.testAsync(stored, value),
      );
    }

    /**
     * Hash a value on the thread pool, then assign it to the field. The row
     * stores what `this[field] = value` stores, in the same format, without
     * blocking the event loop for the scrypt run. On a server, prefer it to
     * assigning a hashed field. A field with another modifier beside
     * {@link Hashed} is assigned at once, on the event loop. Calls on one row
     * that overlap settle in the order their scrypt runs end: await each one.
     *
     * @param field - Name of the field to set.
     * @param value - Value to hash and store.
     *
     * @returns Once the field holds the hash of `value`.
     *
     * @throws Error when `field` has no {@link Hashed} decorator.
     */
    async setHashAsync<This extends object, F extends keyof This>(
      this: This,
      field: F,
      value: This[F] & WriteValue,
    ): Promise<void> {
      const assigned = await withHashedField(
        this,
        field,
        (modifier, stored, alone) =>
          alone ? modifier.lockAsync(stored, value) : value,
      );
      Reflect.set(this, field, assigned);
    }

    /**
     * Tell whether a stored hash needs writing again: it uses an older format
     * or cost. After a successful test, assign the tested value to the field
     * and save the row.
     *
     * @param field - Name of the field to inspect.
     *
     * @returns Whether the stored hash is outdated. False when nothing is stored.
     */
    isHashOutdated<This extends {}>(this: This, field: keyof This) {
      return withHashedField(this, field, (modifier, stored) =>
        modifier.isOutdated(stored),
      );
    }
  };
}

/**
 * Mark a Database Table class field as being hashed.
 *
 * @note The Table class MUST incorporate the {@link HashModifier} mixin.
 *
 * @param options Hash options.
 */
export const Hashed = MakePropertyDecorator(
  (target, propertyKey, options?: Options) => {
    attachModifier(
      target.constructor,
      HashModifier,
      propertyKey,
      options || {},
    );
  },
);
