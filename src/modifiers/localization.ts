import type * as DatabaseDev from "@antelopejs/interface-database";
import { MakePropertyDecorator } from "@antelopejs/interface-core/decorators";

import { type Constructible, getMetadata } from "../common";
import {
  attachModifier,
  ContainerModifier,
  MixinSymbol,
  ModifiersStaticMetadata,
  unlock,
} from "./common";

type Options = {
  /**
   * Fallback locale to use when the selected locale has no value, or an
   * empty one.
   */
  fallbackLocale?: string;
};

/** A text left empty in one language counts as no text in that language. */
const EMPTY_TEXT = "";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function withoutEmptyTexts<V>(values: Record<string, V>): Record<string, V> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== EMPTY_TEXT),
  );
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
export class LocalizationModifier extends ContainerModifier<
  Record<string, never>,
  Options
> {
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
    const modified = getMetadata(TableClass, ModifiersStaticMetadata).fields[
      field
    ]?.find(({ id }) => id === LocalizationModifier.name);
    return (modified?.modifier as LocalizationModifier | undefined)?.options
      .fallbackLocale;
  }

  /**
   * Stores an empty text as no text, so that the fallback locale answers for
   * it in queries too (`unlockrequest`).
   */
  public override lock(
    locked_value: Record<string, unknown> | undefined,
    value: unknown,
    key: string,
  ) {
    if (key === "*") {
      return isObject(value)
        ? withoutEmptyTexts(value as Record<string, unknown>)
        : (value as Record<string, unknown>);
    }
    return withoutEmptyTexts(super.lock(locked_value, value, key));
  }

  public override unlock(locked_value: Record<string, unknown>, key: string) {
    const unlocked = super.unlock(locked_value, key);
    if (unlocked !== undefined && unlocked !== EMPTY_TEXT) {
      return unlocked;
    }
    if (this.options.fallbackLocale) {
      return super.unlock(locked_value, this.options.fallbackLocale);
    }
  }

  public override unlockrequest(
    data: DatabaseDev.ValueProxy<Record<string, unknown>>,
    _meta: DatabaseDev.ValueProxy<Record<string, never>>,
    key: DatabaseDev.ValueProxyOrValue<string>,
  ): DatabaseDev.ValueProxy<unknown> {
    if (this.options.fallbackLocale) {
      return data.key(key).default(data.key(this.options.fallbackLocale));
    }
    return data.key(key);
  }

  [MixinSymbol] = class {
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
      fields?: Array<keyof This>,
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
