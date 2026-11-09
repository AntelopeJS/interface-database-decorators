/** @internal @packageDocumentation */
import * as DatabaseDev from "@antelopejs/interface-database";

import { isRecord } from "./kinds";

export const MixinSymbol = Symbol();

export type MixinType<T> = T extends { [MixinSymbol]: infer A } ? A : never;

export class Modifier<
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Meta is read only by subclasses, through this.meta; removing it changes the published Modifier<Meta, Options>
  Meta extends object = object,
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Options is read only by subclasses, through this.options; removing it changes the published Modifier<Meta, Options>
  Options extends object = object,
> {
  protected meta!: Meta;
  protected options!: Options;
}

export class OneWayModifier<
  LockedType,
  Args extends any[] = [],
  Meta extends object = object,
  Options extends object = object,
> extends Modifier<Meta, Options> {
  public lock(
    _locked_value: LockedType | undefined,
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- the published override point of every modifier; a modified field's value has its table class's type, which the shared modifier chain cannot name
    _value: unknown,
    ..._args: Args
  ): LockedType {
    throw new Error("Unimplemented");
  }
  public test(
    locked_value: LockedType,
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a modified field's value has its table class's type, which the shared modifier chain cannot name
    value: unknown,
    ...args: Args
  ): boolean {
    return this.lock(undefined, value, ...args) === locked_value;
  }
}

type ProxyOrValArray<T extends any[]> = {
  [K in keyof T]: DatabaseDev.ValueProxyOrValue<T[K]>;
};

export class TwoWayModifier<
  LockedType,
  Args extends any[] = [],
  Meta extends object = object,
  Options extends object = object,
> extends OneWayModifier<LockedType, Args, Meta, Options> {
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- the unlocked value has its table class's type, which the shared modifier chain cannot name
  public unlock(_locked_value: LockedType, ..._args: Args): unknown {
    throw new Error("Unimplemented");
  }
  public unlockrequest(
    _data: DatabaseDev.ValueProxy<LockedType>,
    _meta: DatabaseDev.ValueProxy<Meta>,
    ..._args: ProxyOrValArray<Args>
  ): DatabaseDev.ValueProxy<unknown> {
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
export class ContainerModifier<
  Meta extends object = object,
  Options extends object = object,
> extends TwoWayModifier<
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- the container holds the field's values by key, typed by the table class, not by the modifier
  Record<string, unknown>,
  [key: string | undefined],
  Meta,
  Options
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
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- the container holds the field's values by key, typed by the table class, not by the modifier
    locked_value: Record<string, unknown> | undefined,
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a modified field's value has its table class's type, which the shared modifier chain cannot name
    value: unknown,
    key: string | undefined,
  ) {
    if (key === undefined) {
      return locked_value ?? {};
    }
    if (key === "*") {
      if (value === undefined || value === null) {
        return {};
      }
      if (!isRecord(value)) {
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
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- the container holds the field's values by key, typed by the table class, not by the modifier
    locked_value: Record<string, unknown>,
    key: string | undefined,
  ) {
    if (key === undefined) {
      return undefined;
    }
    if (key === "*") {
      return locked_value;
    }
    return Object.hasOwn(locked_value, key) ? locked_value[key] : undefined;
  }
  public override unlockrequest(
    // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- the container holds the field's values by key, typed by the table class, not by the modifier
    data: DatabaseDev.ValueProxy<Record<string, unknown>>,
    _meta: DatabaseDev.ValueProxy<Meta>,
    key: DatabaseDev.ValueProxyOrValue<string | undefined>,
  ): DatabaseDev.ValueProxy<unknown> {
    if (key === undefined) {
      return DatabaseDev.ValueProxy.constant<unknown>(null);
    }
    return data.key(
      key instanceof DatabaseDev.ValueProxy ? key.cast<string>() : key,
    );
  }
}
