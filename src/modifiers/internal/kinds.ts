/** @internal @packageDocumentation */
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
