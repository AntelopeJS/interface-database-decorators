/** @internal @packageDocumentation */
import type {
  WriteDocument,
  WriteValue,
} from "@antelopejs/interface-database/common";

import type { Constructible } from "../../common";
import type {
  Modifier,
  ModifierEvent,
  OneWayModifier,
  TwoWayModifier,
} from "../common";

export function isWriteOnly(
  m: Modifier,
): m is OneWayModifier<WriteValue, any[]> {
  return "lock" in m && !("unlock" in m);
}

export function isLocking(m: Modifier): m is OneWayModifier<WriteValue, any[]> {
  return "lock" in m;
}

export function isTwoWay(m: Modifier): m is TwoWayModifier<WriteValue, any[]> {
  return "unlock" in m;
}

export function isOnlyEvents(modifier: Modifier) {
  return !("lock" in modifier);
}

export const ignoredEventNames = {
  constructor: true,
  lock: true,
  unlock: true,
};

export function isCallable(value: unknown): value is CallableFunction {
  return typeof value === "function";
}

/**
 * Whether a modifier prototype member is a method the engine can run for an
 * event: any function takes the instance, the field and the event arguments.
 */
export function isEventHandler(value: unknown): value is ModifierEvent {
  return typeof value === "function";
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** Whether a value is an object or a function: what a prototype chain holds. */
export function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" || typeof value === "function") && value !== null
  );
}

/** The object the instances of a class inherit from. */
export function prototypeOf(target: Constructible): object {
  const prototype: unknown = target.prototype;
  if (!isObjectLike(prototype)) {
    throw new TypeError("A class prototype must be an object.");
  }
  return prototype;
}

/** Whether `candidate` is the class `base` or a class extending it. */
export function isSameOrSubclass<Base extends Constructible>(
  candidate: Constructible,
  base: Base,
): candidate is Base {
  return candidate === base || base.isPrototypeOf(candidate);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Whether a value written to a row is a document: an object, not a list or a date. */
export function isWriteDocument(value: WriteValue): value is WriteDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}
