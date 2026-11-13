/** @internal @packageDocumentation */
import * as DatabaseDev from "@antelopejs/interface-database";
import type {
  WriteDocument,
  WriteValue,
} from "@antelopejs/interface-database/common";

import type { ModifierState } from "./records";
import { isWriteDocument } from "./kinds";

export const MixinSymbol = Symbol();

export type MixinType<T> = T extends { [MixinSymbol]: infer A } ? A : never;

/**
 * A field modifier. A subclass narrows `options` and `meta` with `declare`
 * to the options it is attached with and the state it keeps for each row.
 */
export class Modifier {
  /** The options the modifier was attached with, see `attachModifier`. */
  public options!: object;
  /** The modifier's state for the row it runs on, stored in the row. */
  protected meta!: ModifierState;
}

export class OneWayModifier<
  LockedType extends WriteValue,
  Args extends any[] = [],
> extends Modifier {
  public lock(
    _locked_value: LockedType | undefined,
    _value: WriteValue,
    ..._args: Args
  ): LockedType {
    throw new Error("Unimplemented");
  }
  public test(
    locked_value: LockedType,
    value: WriteValue,
    ...args: Args
  ): boolean {
    return this.lock(undefined, value, ...args) === locked_value;
  }
}

type ProxyOrValArray<T extends any[]> = {
  [K in keyof T]: DatabaseDev.ValueProxyOrValue<T[K]>;
};

export class TwoWayModifier<
  LockedType extends WriteValue,
  Args extends any[] = [],
> extends OneWayModifier<LockedType, Args> {
  public unlock(_locked_value: LockedType, ..._args: Args): WriteValue {
    throw new Error("Unimplemented");
  }
  public unlockrequest(
    _data: DatabaseDev.ValueProxy<LockedType>,
    _meta: DatabaseDev.ValueProxy<ModifierState>,
    ..._args: ProxyOrValArray<Args>
  ): DatabaseDev.ValueProxy<WriteValue> {
    throw new Error("Unimplemented");
  }
}

/**
 * A modifier that holds a field's values in a record by key, as
 * `LocalizationModifier` holds one text per locale.
 *
 * The key `"*"` addresses the whole record. The key `undefined` is no key:
 * `lock` stores nothing under it, and `unlock` and `unlockrequest` find no
 * value. A key given as a `ValueProxy` goes to the database as it is.
 */
export class ContainerModifier extends TwoWayModifier<
  WriteDocument,
  [key: string | undefined]
> {
  /**
   * Stores `value` under `key`. The wildcard key `"*"` replaces the whole
   * container, so it takes a record of values by key; `undefined` or `null`
   * clears it.
   *
   * @throws TypeError when `key` is `"*"` and `value` is neither a record,
   * `undefined` nor `null`
   */
  public override lock(
    locked_value: WriteDocument | undefined,
    value: WriteValue,
    key: string | undefined,
  ): WriteDocument {
    if (key === undefined) {
      return locked_value ?? {};
    }
    if (key === "*") {
      if (value === undefined || value === null) {
        return {};
      }
      if (!isWriteDocument(value)) {
        throw new TypeError('The "*" key takes a record of values by key');
      }
      return value;
    }
    return locked_value
      ? {
          ...locked_value,
          [key]: value,
        }
      : { [key]: value };
  }
  public override unlock(
    locked_value: WriteDocument,
    key: string | undefined,
  ): WriteValue {
    if (key === undefined) {
      return undefined;
    }
    if (key === "*") {
      return locked_value;
    }
    return Object.hasOwn(locked_value, key) ? locked_value[key] : undefined;
  }
  public override unlockrequest(
    data: DatabaseDev.ValueProxy<WriteDocument>,
    _meta: DatabaseDev.ValueProxy<ModifierState>,
    key: DatabaseDev.ValueProxyOrValue<string | undefined>,
  ): DatabaseDev.ValueProxy<WriteValue> {
    if (key === undefined) {
      return DatabaseDev.ValueProxy.constant<WriteValue>(null);
    }
    return data.key(
      key instanceof DatabaseDev.ValueProxy ? key.cast<string>() : key,
    );
  }
}
