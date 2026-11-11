import type * as DatabaseDev from "@antelopejs/interface-database";

import {
  type Constructible,
  getMetadata,
  type PlainData,
  type PlainRow,
} from "../common";
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
  type InternalRecord,
  type ModifierState,
  newModifiedField,
  unlockArgsOf,
  withRef,
} from "./internal/records";

export {
  ContainerModifier,
  MixinSymbol,
  type MixinType,
  Modifier,
  OneWayModifier,
  TwoWayModifier,
} from "./internal/classes";
import {
  type Modifier,
  type OneWayModifier,
  type TwoWayModifier,
} from "./internal/classes";

/**
 * A table row as the database stores it: the fields of `T` that are set, with
 * no prototype, and its modified fields locked in `_internal` instead of at the
 * top level.
 */
export type StoredRow<T> = Partial<T> & InternalHolder;

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
  metaRef: { _ref: ModifierState | undefined };
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
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- the values assigned before modifiers could lock them, by field name, have their table class's types
  floating: Record<string, unknown> = {};
  /**
   * The arguments each modifier of a field was unlocked or locked with, by
   * field name, then by modifier name.
   */
  fields: Record<string, Record<string, unknown[]>> = {};

  constructor(target: any) {
    this.staticMeta = getMetadata(target.constructor, ModifiersStaticMetadata);
    const byKey: { [field: PropertyKey]: Record<string, unknown[]> } =
      this.fields;
    for (const field of Reflect.ownKeys(this.staticMeta.fields)) {
      byKey[field] = {};
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

  /**
   * Reads a field through its modifiers. A field the row stores reads `null`
   * when its modifiers find no value in it, as under a locale with no text.
   * A field the row does not store, or cannot read yet, reads `undefined`.
   */
  get(field: PropertyKey, internal: InternalRecord) {
    if (Object.hasOwn(this.floating, field)) {
      return floatingByKey(this)[field];
    }
    if (!this.canGet(field)) {
      return;
    }
    const list = fieldsByKey(this.staticMeta)[field];
    const stored = dataByKey(internal)[field];
    let value = stored;
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
    return value === undefined && stored !== undefined ? null : value;
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

  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a modified field's value has its table class's type, which the shared modifier chain cannot name
  set(field: PropertyKey, internal: InternalRecord, value: unknown) {
    if (!this.canSet(field)) {
      floatingByKey(this)[field] = value;
      return;
    }
    const list = fieldsByKey(this.staticMeta)[field];

    const prevlist: {
      id: string;
      modifier: Modifier;
      metaRef: ModifiedField["metaRef"];
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

/** The names of the modified fields of a table instance. */
function fieldNamesOf<T extends { constructor: any }>(object: T) {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);
  // SAFETY: the names attachModifier recorded are keys of the table class of object, so keys of T; Reflect.ownKeys types them string | symbol.
  return Reflect.ownKeys(metaTable.fields) as Array<keyof T>;
}

/**
 * Builds a table instance from unlocked plain data: each key is assigned, so
 * modifiers lock the fields they can. Then runs the `fromPlainData` event.
 */
export function fromPlainData<T extends object>(
  rawObject: PlainData<T>,
  TableClass: Constructible<T>,
): T {
  const instance = {};
  Object.setPrototypeOf(instance, prototypeOf(TableClass));
  Object.assign(instance, Object.fromEntries(Object.entries(rawObject)));
  triggerEvent(instance, "fromPlainData", rawObject);
  // SAFETY: instance gets the prototype of TableClass and the fields of rawObject, so it is a T, as fromPlainData returns; setPrototypeOf types no result.
  return instance as T;
}

/**
 * Converts a table instance to unlocked plain data, without `_internal`. A
 * field still locked comes out `undefined`. Then runs the `toPlainData` event.
 */
export function toPlainData<T extends { constructor: any }>(
  object: T,
): PlainRow<T> {
  const result = { ...object };
  if ("_internal" in result) delete result._internal;
  for (const field of fieldNamesOf(object)) {
    result[field] = object[field];
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
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- rawObject is a stored row, typed any by the published fromDatabase signature; typing it T breaks consumers
  const shallowCopy = { ...rawObject };
  Object.setPrototypeOf(shallowCopy, prototypeOf(TableClass));
  triggerEvent(shallowCopy, "fromDatabase", rawObject);
  // oxlint-disable-next-line typescript/no-unsafe-return -- shallowCopy is a copy of the any-typed rawObject
  return shallowCopy;
}

/**
 * Converts a table instance to the locked record to store, `_internal`
 * included and floating values left out. Then runs the `toDatabase` event.
 */
export function toDatabase<T extends InternalHolder>(
  object: T,
): T & InternalHolder {
  const result = { ...object };
  triggerEvent(object, "toDatabase", result);
  return result;
}

type ExtractModifierOptions<T> =
  T extends Modifier<any, infer Options> ? Options : undefined;
type ExtractModifierArgs<T> =
  T extends OneWayModifier<any, infer Args> ? Args : [];

/**
 * Attaches a modifier to a field of a table class. A property decorator calls
 * it with what it holds: `attachModifier(target.constructor, Modifier,
 * propertyKey, options)`.
 *
 * At compile time, `options` must match the options type of `Modifier`.
 * `TableClass` is any function and `field` any property key: nothing checks
 * that `field` names a member of the class.
 *
 * At run time, a modifier with `lock` replaces the field with an accessor on
 * `TableClass.prototype` that routes reads and writes through the field's
 * modifiers. A modifier without `lock` only handles events, and the field
 * keeps its plain value. Each method of the modifier other than `lock` and
 * `unlock` becomes a handler for the event of the same name.
 *
 * @param TableClass The table class, `target.constructor` in a property
 * decorator.
 * @param Modifier The modifier class. The engine creates one instance per
 * attachment and identifies it by its class name.
 * @param field The field to modify, `propertyKey` in a property decorator.
 * @param options The modifier's options, read through `this.options`.
 * @throws Error when a modifier with `lock` is attached to `constructor` or
 * `__proto__`.
 * @throws Error when a modifier with `lock` is attached to a field that
 * already has a one-way modifier, one with `lock` and no `unlock`.
 */
export function attachModifier<M extends Constructible<Modifier>>(
  TableClass: Function,
  Modifier: M,
  field: PropertyKey,
  options: ExtractModifierOptions<InstanceType<M>>,
) {
  const entry = newModifiedField(Modifier);
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

function fieldsModifiedBy<T extends { constructor: any }>(
  object: T,
  modifierClass: Constructible<Modifier>,
  fields?: ReadonlyArray<keyof T>,
): Array<keyof T> {
  const metaTable = getMetadata(object.constructor, ModifiersStaticMetadata);
  return (fields ?? fieldNamesOf(object)).filter((field) =>
    fieldsByKey(metaTable)[field]?.find(({ id }) => id === modifierClass.name),
  );
}

export function getModifiedFields<T extends { constructor: any }>(
  object: T,
  Modifier: Constructible<Modifier>,
): (keyof T)[] {
  return fieldsModifiedBy(object, Modifier);
}

export function unlock<
  T extends { constructor: any },
  M extends Constructible<Modifier>,
>(
  object: T,
  Modifier: M,
  fields: ReadonlyArray<keyof T> | undefined,
  ...args: ExtractModifierArgs<InstanceType<M>>
) {
  const usedFields = fieldsModifiedBy(object, Modifier, fields);
  const meta = getMetadata(object, ModifiersDynamicMetadata);
  for (const field of usedFields) {
    unlockArgsOf(meta, field)[Modifier.name] = args;
    if (field in meta.floating) {
      Object.assign(object, { [field]: floatingOf(meta, field) });
    }
  }
}

type ModifierWithProxyArgs = {
  modifier: Constructible<TwoWayModifier<any, any[], any, any>>;
  args: unknown[];
};

/**
 * Builds a query expression that reads a field unlocked, for use inside a
 * database query. Each two-way modifier on the field passes the stored value
 * through its own `unlockrequest`. The expression yields the stored value as
 * it is when the field has only one-way modifiers, and the plain field when
 * it has no modifier.
 *
 * At compile time, `field` must be a key of the row type. Nothing ties
 * `table` to the row type, and nothing checks each entry's `args` against
 * its modifier's arguments.
 *
 * @param table The table class. It is read only for its modifier metadata.
 * @param object The row in the query.
 * @param field The field to read.
 * @param modifiers The arguments for each two-way modifier on the field,
 * matched to it by class name.
 * @throws TypeError when `modifiers` has no entry for a two-way modifier on
 * the field.
 */
export function unlockrequest<T extends {}, K extends keyof T>(
  table: Constructible,
  object: DatabaseDev.ValueProxy<T>,
  field: K,
  modifiers: ModifierWithProxyArgs[],
): DatabaseDev.ValueProxy<T[K]> {
  const args = Object.fromEntries(
    modifiers.map(({ modifier, args: modArgs }) => [modifier.name, modArgs]),
  );

  const stored = object.cast<{ _internal: InternalRecord }>();
  const meta = stored.key("_internal").key("meta");
  const metaTable = getMetadata(table, ModifiersStaticMetadata);
  const name = String(field);
  const unlocked = fieldsByKey(metaTable)[field]?.reduce<
    DatabaseDev.ValueProxy<unknown>
  >(
    (data, { id, modifier }) =>
      isWriteOnly(modifier) || !isTwoWay(modifier)
        ? data
        : modifier.unlockrequest(data, meta.key(id), ...args[id]),
    stored.key("_internal").key("data").key(name),
  );
  return (unlocked ?? object.cast<InternalRecord["data"]>().key(name)).cast<
    T[K]
  >();
}

export function lock<
  T extends { constructor: any },
  M extends Constructible<Modifier>,
>(
  object: T,
  Modifier: M,
  fields: ReadonlyArray<keyof T> | undefined,
  ...args: ExtractModifierArgs<InstanceType<M>> | []
) {
  const usedFields = fieldsModifiedBy(object, Modifier, fields);
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

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- exported; removing the parameter changes the published signature
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
