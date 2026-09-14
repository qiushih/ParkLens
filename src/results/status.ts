import { ruleAt } from '../data/rules';
import { isWithinWindow } from '../data/schedule';
import type { ParkingOption, Price, PriceStep, Weekday } from '../data/types';

/** Ordered from most to least useful to someone looking for parking. */
export type Availability = 'available' | 'unknown' | 'restricted' | 'closed';

export interface OptionStatus {
  availability: Availability;
  /** One line, e.g. "$2.80/hr · $13.95 max" or "Free · 2 hr max". */
  summary: string;
}

/** What applies to an option at a local day and minute. */
export function statusAt(option: ParkingOption, day: Weekday, minute: number): OptionStatus {
  if (option.rulesStatus === 'unverified') {
    return { availability: 'unknown', summary: 'Rules unverified · check posted signs' };
  }
  if (option.openHours && !option.openHours.some((window) => isWithinWindow(window, day, minute))) {
    return { availability: 'closed', summary: 'Closed' };
  }

  const rule = ruleAt(option.rules, day, minute);
  if (!rule) return { availability: 'unknown', summary: "Rules for this time aren't listed" };
  if (rule.access === 'permit') return { availability: 'restricted', summary: 'Permit only' };

  const price = rule.price ? describePrice(rule.price) : 'Price not listed';
  const parts = [rule.access === 'facility-visitors' ? `${price} for facility visitors` : price];
  if (rule.maxStayMin !== null) parts.push(`${formatDuration(rule.maxStayMin)} max`);

  const availability: Availability =
    rule.access === 'facility-visitors' ? 'restricted' : rule.price?.kind === 'unknown' || !rule.price ? 'unknown' : 'available';
  return { availability, summary: parts.join(' · ') };
}

export function describePrice(price: Price): string {
  switch (price.kind) {
    case 'free':
      return 'Free';
    case 'unknown':
      return 'Pricing unconfirmed';
    case 'paid-rate-unknown':
      return 'Paid · rate not listed';
    case 'paid': {
      const [only] = price.steps;
      const isFlat = price.steps.length === 1 && only !== undefined && only.blockMin >= 24 * 60;
      const steps = describeSteps(price.steps);
      return price.dailyMax === null || (isFlat && only.amount === price.dailyMax)
        ? steps
        : `${steps} · ${money(price.dailyMax)} max`;
    }
  }
}

function describeSteps(steps: PriceStep[]): string {
  const [first, ...rest] = steps;
  const last = rest.at(-1);
  if (!first) return 'Paid';
  if (!last) {
    if (first.amount === null) return 'Paid · rate unconfirmed';
    return first.blockMin >= 24 * 60 ? `${money(first.amount)} flat` : rate(first.amount, first.blockMin);
  }

  const firstSpan = formatDuration(first.toMin ?? first.blockMin);
  const opening =
    first.amount === 0
      ? `Free for the first ${firstSpan}`
      : `${first.amount === null ? 'Unconfirmed rate' : money(first.amount)} for the first ${firstSpan}`;
  const after = last.fromMin === first.toMin ? '' : ` after ${formatDuration(last.fromMin)}`;
  const then = last.amount === null ? 'then paid (rate unconfirmed)' : `then ${rate(last.amount, last.blockMin)}${after}`;
  return `${opening}, ${then}`;
}

function rate(amount: number, blockMin: number): string {
  return blockMin === 60 ? `${money(amount)}/hr` : `${money(amount)} per ${formatDuration(blockMin)}`;
}

function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0 ? `${String(hours)} hr` : `${String(hours)} hr ${String(rest)} min`;
}
