import type * as DatabaseDev from "@antelopejs/interface-database";
import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";
import {
  type Cipher,
  type CipherGCM,
  createCipheriv,
  createDecipheriv,
  type Decipher,
  type DecipherGCM,
  randomBytes,
} from "node:crypto";

import { attachModifier, MixinSymbol, TwoWayModifier } from "./common";
import { isCallable, isRecord, isString } from "./internal/kinds";

type Options = {
  /** Encryption algorithm (for supported algorithms refer to {@link createCipheriv}) */
  algorithm?: string;
  /** Encryption key. */
  secretKey: string;
  /** Initialization Vector size. */
  ivSize?: number;
};
type Meta = Record<string, never>;
type LockedType = [ciphertext: string, iv: string, authTag?: string];

function date_encoder(this: any, key: string) {
  return this[key] instanceof Date
    ? {
        value: this[key].toUTCString(),
        type: "Date",
      }
    : this[key];
}

type StoredValue =
  | null
  | boolean
  | number
  | string
  | Date
  | StoredValue[]
  | { [key: string]: StoredValue };

/**
 * The Date a stored marker `{ type: "Date", value }` stands for, when `value`
 * is a text `toUTCString` produces, as `date_encoder` writes it. Any other
 * object was stored by the caller.
 */
function dateOfMarker(candidate: StoredValue): Date | undefined {
  if (
    !isRecord(candidate) ||
    Object.keys(candidate).length !== 2 ||
    candidate.type !== "Date" ||
    !isString(candidate.value)
  ) {
    return undefined;
  }
  const date = new Date(candidate.value);
  return date.toUTCString() === candidate.value ? date : undefined;
}

function date_decoder(_key: string, value: StoredValue) {
  return dateOfMarker(value) ?? value;
}

function hasAuthTag(
  cipher: Cipher,
): cipher is Cipher & Pick<CipherGCM, "getAuthTag"> {
  return "getAuthTag" in cipher && isCallable(cipher.getAuthTag);
}

function acceptsAuthTag(
  decipher: Decipher,
): decipher is Decipher & Pick<DecipherGCM, "setAuthTag"> {
  return "setAuthTag" in decipher && isCallable(decipher.setAuthTag);
}

/**
 * Encryption modifier. enables the use of {@link Encrypted} on table fields.
 *
 * These fields are stored encrypted in the database.
 */
export class EncryptionModifier extends TwoWayModifier<
  LockedType,
  [],
  Meta,
  Options
> {
  readonly autolock = true;

  public override lock(
    _locked_value: LockedType | undefined,
    value: unknown,
  ): LockedType {
    const iv = randomBytes(this.options.ivSize || 16);
    const cipher = createCipheriv(
      this.options.algorithm || "aes-256-gcm",
      this.options.secretKey,
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value, date_encoder)),
      cipher.final(),
    ]).toString("base64");

    let authTag: string | undefined;
    try {
      authTag = hasAuthTag(cipher)
        ? cipher.getAuthTag().toString("base64")
        : undefined;
    } catch {}

    return [encrypted, iv.toString("base64"), authTag];
  }

  readonly autounlock = true;

  public override unlock([locked_value, iv_str, authTag]: LockedType) {
    const decipher = createDecipheriv(
      this.options.algorithm || "aes-256-gcm",
      this.options.secretKey,
      Buffer.from(iv_str, "base64"),
    );

    if (acceptsAuthTag(decipher) && authTag) {
      decipher.setAuthTag(Buffer.from(authTag, "base64"));
    }

    const decoded: unknown = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(locked_value, "base64")),
        decipher.final(),
      ]).toString("utf8"),
      date_decoder,
    );
    return decoded;
  }

  public override unlockrequest(
    data: DatabaseDev.ValueProxy<LockedType>,
  ): DatabaseDev.ValueProxy<unknown> {
    // SAFETY: the proxy is returned unchanged and unlockrequest performs no runtime check on LockedType; the cast only erases the static element type to unknown, which every stored value satisfies.
    return data as DatabaseDev.ValueProxy<unknown>;
  }

  [MixinSymbol] = class {};
}

/**
 * Mark a Database Table class field as being encrypted.
 *
 * @note The Table class MUST incorporate the {@link EncryptionModifier} mixin.
 *
 * @param options Encryption options.
 */
export const Encrypted = MakePropertyDecorator(
  (target, propertyKey, options: Options) => {
    attachModifier(
      target.constructor,
      EncryptionModifier,
      propertyKey,
      options,
    );
  },
);
