import type * as DatabaseDev from "@antelopejs/interface-database";

import { type Constructible, getMetadata } from "../common";
import {
  ignoredEventNames,
  isEventHandler,
  isLocking,
  isOnlyEvents,
  isTwoWay,
  isWriteOnly,
  prototypeOf,
} from "./internal/kinds";
import {
  assertModifiableField,
  copyModifierLists,
  dataByKey,
  eventsByKey,
  fieldsByKey,
  floatingByKey,
  floatingOf,
  getInternal,
  type InternalHolder,
  unlockArgsOf,
  withRef,
} from "./internal/records";

export const MixinSymbol = Symbol();

export type MixinType<T> = T extends { [MixinSymbol]: infer A } ? A : never;

export class Modifier<
  Meta extends object = object,
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
    _value: unknown,
    ..._args: Args
  ): LockedType {
    throw new Error("Unimplemented");
  }
  public test(
    locked_value: LockedType,
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

export class ContainerModifier<
  Meta extends object = object,
  Options extends object = object,
> extends TwoWayModifier<
  Record<string, unknown>,
  [key: string],
  Meta,
  Options
> {
  public override lock(
    locked_value: Record<string, unknown> | undefined,
    value: unknown,
    key: string,
  ) {
    if (key === "*") {
      return value as Record<string, unknown>;
    }
    return locked_value
      ? {
          ...locked_value,
          [key]: value,
        }
      : { [key]: value };
  }
  public override unlock(locked_value: Record<string, unknown>, key: string) {
    if (key === "*") {
      return locked_value;
    }
    return Object.hasOwn(locked_value, key) ? locked_value[key] : undefined;
  }
  public override unlockrequest(
    data: DatabaseDev.ValueProxy<Record<string, unknown>>,
    _meta: DatabaseDev.ValueProxy<Meta>,
    key: DatabaseDev.ValueProxyOrValue<string>,
  ): DatabaseDev.ValueProxy<unknown> {
    return data.key(key);
  }
}

interface InternalType {
  meta: Record<string, object>;
  data: Record<string, any>;
}

/**
 * A modifier method run for an event of the table instance (`insert`,
 * `toDatabase`, ...), with the modifier as `this`.
 */
export type ModifierEvent = (
  this: Modifier,
  object: { constructor: any },
  field: PropertyKey,
  ...args: unknown[]
) => void;

interface ModifiedField {
  id: string;
  modifier: Modifier;
  metaRef: { _ref: any };
}

export class ModifiersStaticMetadata {
  public static key = Symbol.for(
    "@antelopejs/interface-database-decorators/ModifiersStaticMetadata@1",
  );

  /**
   * The metadata of a subclass of a table: a copy of its parent's lists, so
   * modifiers attached on the subclass never reach the parent or its siblings.
   */
  public static inherit(parent: ModifiersStaticMetadata) {
    return copyModifierLists(new ModifiersStaticMetadata(), parent);
  }

  public fields: Record<string, Array<ModifiedField>> = {};

  public events = new Map<
    string,
    Array<[field: string, modified: ModifiedField, handler: ModifierEvent]>
  >();
}

export class ModifiersDynamicMetadata {
  public static key = Symbol.for(
    "@antelopejs/interface-database-decorators/ModifiersDynamicMetadata@1",
  );

  staticMeta: ModifiersStaticMetadata;
  /**
   * Values assigned to a field before its modifiers could lock them, by field
   * name. Reads return them; `unlock` and `lock` assign them again.
   */
  floating: Record<string, any> = {};
  /**
   * The arguments each modifier of a field was unlocked or locked with, by
   * field name, then by modifier name.
   */
  fields: Record<string, Record<string, unknown[]>> = {};

  constructor(target: any) {
    this.staticMeta = getMetadata(target.constructor, ModifiersStaticMetadata);
    for (const field of Object.keys(this.staticMeta.fields)) {
      this.fields[field] = {};
    }
  }

  canGet(field: PropertyKey) {
    const list = fieldsByKey(this.staticMeta)[field];
    const lastModifier = list[list.length - 1].modifier;
    if ("autolock" in lastModifier && lastModifier.autolock) {
      return true;
    }

    return (
      !isWriteOnly(lastModifier) &&
      !list.some(
        ({ id, modifier }) =>
          !("autounlock" in modifier && modifier.autounlock) &&
          "unlock" in modifier &&
          !(id in unlockArgsOf(this, field)),
      )
    );
  }

  get(field: PropertyKey, internal: InternalType) {
    if (Object.hasOwn(this.floating, field)) {
      return floatingByKey(this)[field];
    }
    if (!this.canGet(field)) {
      return;
    }
    const list = fieldsByKey(this.staticMeta)[field];
    let value = dataByKey(internal)[field];
    for (const { id, modifier, metaRef } of list) {
      if (isTwoWay(modifier) && value !== undefined) {
        if (unlockArgsOf(this, field)[id]) {
          value = withRef(internal, id, modifier, metaRef, (modifier) =>
            modifier.unlock(value, ...unlockArgsOf(this, field)[id]),
          );
        } else if ("autounlock" in modifier && modifier.autounlock) {
          value = withRef(internal, id, modifier, metaRef, (modifier) =>
            modifier.unlock(value),
          );
        }
      }
    }
    return value;
  }

  canSet(field: PropertyKey) {
    const list = fieldsByKey(this.staticMeta)[field];
    return !list.some(
      ({ id, modifier }) =>
        !("autolock" in modifier && modifier.autolock) &&
        "lock" in modifier &&
        !(id in unlockArgsOf(this, field)),
    );
  }

  set(field: PropertyKey, internal: InternalType, value: unknown) {
    if (!this.canSet(field)) {
      floatingByKey(this)[field] = value;
      return;
    }
    const list = fieldsByKey(this.staticMeta)[field];

    const prevlist: {
      id: string;
      modifier: Modifier;
      metaRef: { _ref: any };
      prev: unknown;
    }[] = [];
    let prev = dataByKey(internal)[field];
    for (let i = 0; i < list.length - 1; ++i) {
      const { id, modifier, metaRef } = list[i];
      prevlist[i] = { id, modifier, metaRef, prev };
      if (isTwoWay(modifier)) {
        if (unlockArgsOf(this, field)[id]) {
          prev = modifier.unlock(prev, ...unlockArgsOf(this, field)[id]);
        } else {
          prev = undefined;
        }
      }
    }
    prevlist.push({
      ...list[list.length - 1],
      prev,
    });

    for (let i = prevlist.length - 1; i >= 0; --i) {
      const { id, modifier, metaRef, prev } = prevlist[i];
      if (isLocking(modifier)) {
        value = withRef(internal, id, modifier, metaRef, (modifier) =>
          modifier.lock(prev, value, ...(unlockArgsOf(this, field)[id] || [])),
        );
      }
    }
    dataByKey(internal)[field] = value;
    delete floatingByKey(this)[field];
  }
}

/**
 * Builds a table instance from unlocked plain data: each key is assigned, so
 * modifiers lock the fields they can. Then runs the `fromPlainData` event.
 */
export function fromPlainData<T extends Constructible>(
  rawObject: Record<string, any>,
  TableClass: T,
): InstanceType<T> {
  const shallowCopy: typeof rawObject = {};
  Object.setPrototypeOf(shallowCopy, prototypeOf(TableClass));
  for (const [key, val] of Object.entries(rawObject)) {
    shallowCopy[key] = val;
  }
  triggerEvent(shallowCopy, "fromPlainData", rawObject);
  return shallowCopy as InstanceType<T>;
}

/**
 * Converts a table instance to unlocked plain data, without `_internal`. A
 * field still locked comes out `undefined`. Then runs the `toPlainData` event.
 */
export function toPlainData<T extends { constructor: any }>(
  object: T,
): Record<string, any> {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);
  const result = { ...object };
  if ("_internal" in result) delete result._internal;
  for (const field of Object.keys(metaTable.fields)) {
    const key = <keyof T>field;
    result[key] = object[key];
  }
  triggerEvent(object, "toPlainData", result);
  return result;
}

/**
 * Builds a table instance from a stored record, its modified fields still
 * locked in `_internal`. Then runs the `fromDatabase` event.
 */
export function fromDatabase<T extends Constructible>(
  rawObject: any,
  TableClass: T,
): InstanceType<T> {
  const shallowCopy = { ...rawObject };
  Object.setPrototypeOf(shallowCopy, prototypeOf(TableClass));
  triggerEvent(shallowCopy, "fromDatabase", rawObject);
  return shallowCopy;
}

/**
 * Converts a table instance to the locked record to store, `_internal`
 * included and floating values left out. Then runs the `toDatabase` event.
 */
export function toDatabase(object: { constructor: any }): Record<string, any> {
  const result = { ...object };
  triggerEvent(object, "toDatabase", result);
  return result;
}

type ExtractModifierOptions<T> =
  T extends Modifier<any, infer Options> ? Options : undefined;
type ExtractModifierArgs<T> =
  T extends OneWayModifier<any, infer Args> ? Args : [];

export function attachModifier<
  T extends Constructible,
  M extends Constructible<Modifier>,
>(
  TableClass: T,
  Modifier: M,
  field: keyof InstanceType<T>,
  options: ExtractModifierOptions<InstanceType<M>>,
) {
  const entry: ModifiedField = {
    id: Modifier.name,
    modifier: new Modifier(),
    metaRef: { _ref: {} },
  };
  Object.assign(entry.modifier, {
    meta: new Proxy(entry.metaRef, {
      get: (self, p) => {
        if (!self._ref) return undefined;
        return self._ref[p];
      },
      set: (self, p, v) => {
        if (!self._ref) self._ref = {};
        return Reflect.set(self._ref, p, v, self._ref);
      },
    }),
  });
  Object.assign(entry.modifier, { options });

  const metaTable = getMetadata(TableClass, ModifiersStaticMetadata);

  if (!isOnlyEvents(entry.modifier)) {
    assertModifiableField(TableClass.name, entry.id, field);
    if (Object.hasOwn(metaTable.fields, field)) {
      const list = fieldsByKey(metaTable)[field];
      const last = list[list.length - 1];
      if (isWriteOnly(last.modifier)) {
        if (isWriteOnly(entry.modifier)) {
          throw new Error(
            `Attempted adding Modifier ${entry.id} on ${TableClass.name}.${String(field)} but it already has a One-Way Modifier`,
          );
        } else {
          throw new Error(
            `Adding Modifier ${entry.id} on ${TableClass.name}.${String(field)} after a One-Way Modifier, please review your ordering.`,
          );
        }
      } else {
        list.splice(list.length - 1, 0, entry);
      }
    } else {
      fieldsByKey(metaTable)[field] = [entry];
      Object.defineProperty(TableClass.prototype, field, {
        get: function (this: InternalHolder) {
          return getMetadata(this, ModifiersDynamicMetadata).get(
            field,
            getInternal(this),
          );
        },
        set: function (this: InternalHolder, value) {
          getMetadata(this, ModifiersDynamicMetadata).set(
            field,
            getInternal(this),
            value,
          );
        },
      });
    }
  }

  if (!("toJSON" in TableClass.prototype)) {
    Object.defineProperty(TableClass.prototype, "toJSON", {
      value: function () {
        return toPlainData(this);
      },
    });
  }

  for (const event of Object.getOwnPropertyNames(Modifier.prototype)) {
    const handler: unknown = Modifier.prototype[event];
    if (!Object.hasOwn(ignoredEventNames, event) && isEventHandler(handler)) {
      if (!metaTable.events.has(event)) {
        metaTable.events.set(event, []);
      }
      eventsByKey(metaTable).get(event)?.push([field, entry, handler]);
    }
  }
}

function fieldsModifiedBy<T>(
  metaTable: ModifiersStaticMetadata,
  modifierClass: Constructible<Modifier>,
  fields?: Array<keyof T>,
): Array<keyof T> {
  return (fields ?? (Object.keys(metaTable.fields) as Array<keyof T>)).filter(
    (field) =>
      fieldsByKey(metaTable)[field]?.find(
        ({ id }) => id === modifierClass.name,
      ),
  );
}

export function getModifiedFields<T extends { constructor: any }>(
  object: T,
  Modifier: Constructible<Modifier>,
): (keyof T)[] {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);
  return fieldsModifiedBy<T>(metaTable, Modifier);
}

export function unlock<
  T extends { constructor: any },
  M extends Constructible<Modifier>,
>(
  object: T,
  Modifier: M,
  fields: Array<keyof T> | undefined,
  ...args: ExtractModifierArgs<InstanceType<M>>
) {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);
  const usedFields = fieldsModifiedBy<T>(metaTable, Modifier, fields);
  const meta = getMetadata(object, ModifiersDynamicMetadata);
  for (const field of usedFields) {
    unlockArgsOf(meta, field)[Modifier.name] = args;
    if (field in meta.floating) {
      object[field] = floatingOf(meta, field);
    }
  }
}

type ModifierWithProxyArgs = {
  modifier: Constructible<TwoWayModifier<any, any[], any, any>>;
  args: DatabaseDev.ValueProxyOrValue<any>[];
};
export function unlockrequest<T extends {}, K extends keyof T>(
  table: Constructible<T>,
  object: DatabaseDev.ValueProxy<T>,
  field: K,
  modifiers: ModifierWithProxyArgs[],
): DatabaseDev.ValueProxy<T[K]> {
  const args = Object.fromEntries(
    modifiers.map(({ modifier, args: modArgs }) => [modifier.name, modArgs]),
  );

  const stored = <any>object;
  const meta = stored.key("_internal").key("meta");
  const metaTable = getMetadata(table, ModifiersStaticMetadata);
  return (
    fieldsByKey(metaTable)[field]?.reduce((data, { id, modifier }) => {
      if (isWriteOnly(modifier) || !isTwoWay(modifier)) {
        return data;
      }
      data = modifier.unlockrequest(data, meta.key(id), ...args[id]);
      return data;
    }, stored.key("_internal").key("data").key(field)) || stored.key(field)
  );
}

export function lock<
  T extends { constructor: any },
  M extends Constructible<Modifier>,
>(
  object: T,
  Modifier: M,
  fields: Array<keyof T> | undefined,
  ...args: ExtractModifierArgs<InstanceType<M>> | []
) {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);
  const usedFields = fieldsModifiedBy<T>(metaTable, Modifier, fields);
  const meta = getMetadata(object, ModifiersDynamicMetadata);
  for (const field of usedFields) {
    const val = object[field];
    unlockArgsOf(meta, field)[Modifier.name] = args;
    object[field] = val;
  }
}

export function testValue<T extends { constructor: any }, K extends keyof T>(
  object: T,
  field: K,
  value: T[K],
) {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);
  const meta = getMetadata(object, ModifiersDynamicMetadata);
  const internal = getInternal(object);
  const val: unknown = dataByKey(internal)[field];
  for (const { id, modifier, metaRef } of fieldsByKey(metaTable)[field]) {
    const args =
      unlockArgsOf(meta, field)[id] ||
      ("autolock" in modifier && modifier.autolock ? [] : undefined);
    if (!args) return false;
    if (isWriteOnly(modifier)) {
      return withRef(internal, id, modifier, metaRef, (modifier) =>
        modifier.test(val, value, ...args),
      );
    }
    if (isTwoWay(modifier) && val !== undefined) {
      return withRef(internal, id, modifier, metaRef, (modifier) =>
        modifier.unlock(val, ...args),
      );
    }
  }
  return val === value;
}

export function triggerEvent<T extends { constructor: any }>(
  object: T,
  event: string,
  ...args: unknown[]
) {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);

  if (!metaTable.events.has(event)) {
    return;
  }

  const internal = getInternal(object);

  const eventEntries = metaTable.events.get(event);
  if (!eventEntries) return;

  for (const [field, { id, modifier, metaRef }, handler] of eventEntries) {
    withRef(internal, id, modifier, metaRef, (modifier) => {
      handler.call(modifier, object, field, ...args);
    });
  }
}
