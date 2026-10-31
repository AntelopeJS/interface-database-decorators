/** @internal @packageDocumentation */
import type { Constructible } from "../../common";
import type { Modifier, OneWayModifier, TwoWayModifier } from "../common";

export function isWriteOnly(m: Modifier): m is OneWayModifier<unknown, any[]> {
  return "lock" in m && !("unlock" in m);
}

export function isLocking(m: Modifier): m is OneWayModifier<unknown, any[]> {
  return "lock" in m;
}

export function isTwoWay(m: Modifier): m is TwoWayModifier<unknown, any[]> {
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

export function isString(value: unknown): value is string {
  return typeof value === "string";
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
