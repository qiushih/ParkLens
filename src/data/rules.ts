import { isWithinWindow } from './schedule.ts';
import type { ParkingRule, Weekday } from './types.ts';

/**
 * The rule in effect at a moment: the first rule whose window matches (`when: null` matches any
 * time), or null when no rule covers it and the rules for that time are unknown.
 */
export function ruleAt(rules: readonly ParkingRule[], day: Weekday, minute: number): ParkingRule | null {
  return rules.find((rule) => rule.when === null || isWithinWindow(rule.when, day, minute)) ?? null;
}
