import type * as DatabaseDev from "@antelopejs/interface-database";
import type {
  WriteDocument,
  WriteValue,
} from "@antelopejs/interface-database/common";
import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";

import { type Constructible, getMetadata, type PlainData } from "../common";
import { isRecord, isString } from "./internal/kinds";
import {
  attachModifier,
  ContainerModifier,
  MixinSymbol,
  ModifiersStaticMetadata,
  unlock,
} from "./common";
import type { ModifierState } from "./internal/records";

type Options = {
  /**
   * Fallback locale to use when the selected locale has no value, or an
   * empty one.
   */
  fallbackLocale?: string;
};

/** The keys of the methods of `This`. */
type MethodKey<This> = {
  [P in keyof This]-?: This[P] extends (...args: never[]) => void ? P : never;
}[keyof This];

/**
 * A row read through `localize("*", fields)`: each listed field `K` holds its
 * values by locale, and every other field keeps its type. A listed method
 * stays callable. Its `localize` selects a locale again and gives back the
 * row type.
 */
export type LocalizedRecords<This, K extends keyof This> = Omit<
  This,
  K | "localize"
> & {
  [P in Exclude<K, "localize">]: Record<string, Exclude<This[P], undefined>>;
} & Pick<This, Extract<Exclude<K, "localize">, MethodKey<This>>> & {
    localize(locale: string, fields?: ReadonlyArray<keyof This>): This;
  };

/**
 * The values that count as no text in one language: an empty text, and the
 * `null` a read with no text answers.
 */
const NO_TEXT = new Set<unknown>([undefined, null, ""]);

function withoutMissingTexts<V>(values: Record<string, V>): Record<string, V> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => !NO_TEXT.has(value)),
  );
}

/** Whether `value` is an object literal, not an array, a date or a class instance. */
function isPlainObject(value: unknown): value is object {
  if (!isRecord(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Localization modifier. enables the use of {@link Localized} on table fields.
 *
 * Localized fields contain multiple values (one for each language).
 * Accessing a particular value is done by first calling {@link localize} on the Table class instance.
 * This method is added through the mixin class.
 *
 * See {@link ContainerModifier} for the generic modifier.
 */
export class LocalizationModifier extends ContainerModifier {
  declare public options: Options;

  /**
   * The fallback locale of a localized field of a table class.
   *
   * @param TableClass Table class declaring the field
   * @param field Field name
   * @returns The field's `fallbackLocale`, or `undefined` when the field is
   * not localized or declares none
   */
  public static fallbackLocaleOf(
    TableClass: Constructible,
    field: string,
  ): string | undefined {
    const options = getMetadata(TableClass, ModifiersStaticMetadata).fields[
      field
    ]?.find(({ id }) => id === LocalizationModifier.name)?.modifier.options;
    return options &&
      "fallbackLocale" in options &&
      isString(options.fallbackLocale)
      ? options.fallbackLocale
      : undefined;
  }

  /**
   * Stores an empty text or `null` as no text, so that the fallback locale
   * answers for it in queries too (`unlockrequest`). A read with no text
   * answers `null`, so saving that answer again stores nothing.
   */
  public override lock(
    locked_value: WriteDocument | undefined,
    value: WriteValue,
    key: string | undefined,
  ): WriteDocument {
    return withoutMissingTexts(super.lock(locked_value, value, key));
  }

  /** The value under `key`, else under the fallback locale. */
  public override unlock(
    locked_value: WriteDocument,
    key: string | undefined,
  ): WriteValue {
    const unlocked = super.unlock(locked_value, key);
    if (!NO_TEXT.has(unlocked)) {
      return unlocked;
    }
    if (this.options.fallbackLocale) {
      return super.unlock(locked_value, this.options.fallbackLocale);
    }
    return undefined;
  }

  /**
   * Reads a field that plain data gives as a plain object as its values by
   * locale, as `PlainData` types it, whatever locale the row is read with
   * afterwards. A field with a modifier inside its locales, such as
   * `@Localized() @Encrypted()`, keeps the value for the next locale selected:
   * that modifier transforms the value before the locales are set.
   */
  public fromPlainData<T extends { constructor: Function }>(
    object: T,
    field: Extract<keyof T, string>,
    raw: PlainData<T>,
  ) {
    const modifiers = getMetadata(object.constructor, ModifiersStaticMetadata)
      .fields[field];
    if (
      modifiers?.at(-1)?.id === LocalizationModifier.name &&
      isPlainObject(raw[field])
    ) {
      unlock(object, LocalizationModifier, [field], "*");
    }
  }

  public override unlockrequest(
    data: DatabaseDev.ValueProxy<WriteDocument>,
    meta: DatabaseDev.ValueProxy<ModifierState>,
    key: DatabaseDev.ValueProxyOrValue<string | undefined>,
  ): DatabaseDev.ValueProxy<WriteValue> {
    const unlocked = super.unlockrequest(data, meta, key);
    const { fallbackLocale } = this.options;
    return fallbackLocale
      ? unlocked.default(data.key(fallbackLocale))
      : unlocked;
  }

  [MixinSymbol] = class {
    /**
     * Read or write every locale of the listed localized fields at once.
     *
     * @param locale - The wildcard key `"*"`.
     * @param fields - Localized field names to unlock. Picks from the fields of the object this function is mixed into.
     *
     * @returns `this`, typed with each listed field as its values by locale
     */
    localize<This extends { constructor: any }, K extends keyof This>(
      this: This,
      locale: "*",
      fields: readonly K[],
    ): LocalizedRecords<This, K>;
    /**
     * Specify which locale to use for accessing some or all localized fields.
     *
     * @param locale - Locale to use to unlock the field(s).
     * @param fields - Field names to unlock. Picks from the fields of the object this function is mixed into.
     *
     * @returns `this`
     */
    localize<This extends { constructor: any }>(
      this: This,
      locale: string,
      fields?: ReadonlyArray<keyof This>,
    ): This;
    localize<This extends { constructor: any }>(
      this: This,
      locale: string,
      fields?: ReadonlyArray<keyof This>,
    ): This {
      unlock(this, LocalizationModifier, fields, locale);
      return this;
    }
  };
}

/**
 * Mark a Database Table class field as being localized.
 *
 * @note The Table class MUST incorporate the {@link LocalizationModifier} mixin.
 *
 * @param options Localization options.
 */
export const Localized = MakePropertyDecorator(
  (target, propertyKey, options?: Options) => {
    attachModifier(
      target.constructor,
      LocalizationModifier,
      propertyKey,
      options || {},
    );
  },
);
