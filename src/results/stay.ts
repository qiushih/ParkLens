import { isWithinWindow } from '../data/schedule';
import type { ParkingOption, Price, PriceStep, Weekday } from '../data/types';
import { formatDayTime, formatDuration, formatMoney, formatTime } from './format';
import { describeRule } from './status';

/** A planned visit, in Kitchener–Waterloo local time. */
export interface StayRequest {
  day: Weekday;
  /** Arrival, in minutes since local midnight. */
  minute: number;
  durationMin: number;
}

/** Ordered from best to worst. */
export type Fit = 'fits' | 'partial' | 'unknown' | 'restricted' | 'not-allowed';

export type StayCost =
  | { kind: 'free' }
  | { kind: 'exact'; amount: number }
  /** The stay crosses more than one paid rule. Each part is priced on its own, so the total may be off. */
  | { kind: 'estimate'; amount: number }
  | { kind: 'unknown' };

/** A stretch of the stay under one rule (or none). Offsets are minutes after arrival. */
export interface StaySegment {
  fromMin: number;
  toMin: number;
  summary: string;
}

export interface StayEvaluation {
  fit: Fit;
  /** Minutes after arrival when parking stops being allowed; null if the whole stay is allowed. */
  allowedMin: number | null;
  stopReason: 'max-stay' | 'permit' | 'closed' | null;
  /** Minutes after arrival from which the rules aren't known; null if they're known throughout. */
  unknownFromMin: number | null;
  /** Cost of the allowed part of the stay. */
  cost: StayCost;
  segments: StaySegment[];
}

/** Walks the stay minute by minute and prices each stretch under a single rule. */
export function evaluateStay(option: ParkingOption, stay: StayRequest): StayEvaluation {
  if (option.rulesStatus === 'unverified') {
    return { fit: 'unknown', allowedMin: null, stopReason: null, unknownFromMin: 0, cost: { kind: 'unknown' }, segments: [] };
  }

  const segments: StaySegment[] = [];
  const charges: (number | null)[] = [];
  let allowedMin: number | null = null;
  let stopReason: StayEvaluation['stopReason'] = null;
  let unknownFromMin: number | null = null;
  let restricted = false;

  for (const { fromMin, toMin, key } of splitStay(option, stay)) {
    if (key === 'closed') {
      segments.push({ fromMin, toMin, summary: 'Closed' });
      allowedMin = fromMin;
      stopReason = 'closed';
      break;
    }
    if (key === 'no-rule') {
      segments.push({ fromMin, toMin, summary: "Rules not listed" });
      unknownFromMin ??= fromMin;
      charges.push(null);
      continue;
    }

    const rule = option.rules[key];
    if (!rule) continue;
    segments.push({ fromMin, toMin, summary: describeRule(rule).summary });

    if (rule.access === 'permit') {
      allowedMin = fromMin;
      stopReason = 'permit';
      break;
    }
    if (rule.access === 'facility-visitors') restricted = true;
    if (rule.price?.kind === 'unknown') unknownFromMin ??= fromMin;

    const minutes = toMin - fromMin;
    if (rule.maxStayMin !== null && minutes > rule.maxStayMin) {
      charges.push(chargeFor(rule.price, rule.maxStayMin));
      allowedMin = fromMin + rule.maxStayMin;
      stopReason = 'max-stay';
      break;
    }
    charges.push(chargeFor(rule.price, minutes));
  }

  const fit: Fit =
    allowedMin === 0
      ? 'not-allowed'
      : allowedMin !== null
        ? 'partial'
        : restricted
          ? 'restricted'
          : unknownFromMin !== null
            ? 'unknown'
            : 'fits';

  return { fit, allowedMin, stopReason, unknownFromMin, cost: totalCost(charges), segments };
}

/** Cost of `minutes` under price steps; null if any part reached has an unconfirmed amount. */
export function stepsCost(steps: readonly PriceStep[], minutes: number): number | null {
  let total = 0;
  for (const step of steps) {
    const overlap = Math.min(minutes, step.toMin ?? Infinity) - step.fromMin;
    if (overlap <= 0) continue;
    if (step.amount === null) return null;
    total += Math.ceil(overlap / step.blockMin) * step.amount;
  }
  return roundCents(total);
}

/** One line for a stay, e.g. "$8.40 for your stay" or "2 hr max · move by 12:00 p.m. · free until then". */
export function describeStay(evaluation: StayEvaluation, stay: StayRequest): string {
  const { allowedMin, cost } = evaluation;
  switch (evaluation.fit) {
    case 'not-allowed':
      return evaluation.stopReason === 'closed' ? 'Closed when you arrive' : 'Permit only when you arrive';
    case 'partial': {
      const until = clockAfter(stay, allowedMin ?? 0);
      const lead =
        evaluation.stopReason === 'max-stay'
          ? `${formatDuration(allowedMin ?? 0)} max · move by ${until}`
          : evaluation.stopReason === 'closed'
            ? `Closes at ${until}`
            : `Permit only from ${until}`;
      return `${lead} · ${costUntilThen(cost)}`;
    }
    case 'restricted':
      return 'For facility visitors only';
    case 'unknown':
      return evaluation.unknownFromMin === null || evaluation.unknownFromMin === 0
        ? "Rules for your arrival time aren't listed"
        : `Rules after ${clockAfter(stay, evaluation.unknownFromMin)} aren't listed`;
    case 'fits':
      return costForStay(cost);
  }
}

/** Local clock time `offsetMin` after arrival, with the weekday once the stay has crossed midnight. */
export function clockAfter(stay: StayRequest, offsetMin: number): string {
  const absolute = stay.minute + offsetMin;
  if (absolute < 1440) return formatTime(absolute);
  return formatDayTime(((stay.day + Math.floor(absolute / 1440)) % 7) as Weekday, absolute % 1440);
}

type SegmentKey = 'closed' | 'no-rule' | number;

function splitStay(option: ParkingOption, stay: StayRequest): { fromMin: number; toMin: number; key: SegmentKey }[] {
  const segments: { fromMin: number; toMin: number; key: SegmentKey }[] = [];
  for (let offset = 0; offset < stay.durationMin; offset++) {
    const absolute = stay.minute + offset;
    const day = ((stay.day + Math.floor(absolute / 1440)) % 7) as Weekday;
    const key = keyAt(option, day, absolute % 1440);
    const last = segments.at(-1);
    if (last?.key === key) last.toMin = offset + 1;
    else segments.push({ fromMin: offset, toMin: offset + 1, key });
  }
  return segments;
}

function keyAt(option: ParkingOption, day: Weekday, minute: number): SegmentKey {
  if (option.openHours && !option.openHours.some((window) => isWithinWindow(window, day, minute))) return 'closed';
  const index = option.rules.findIndex((rule) => rule.when === null || isWithinWindow(rule.when, day, minute));
  return index === -1 ? 'no-rule' : index;
}

function chargeFor(price: Price | null, minutes: number): number | null {
  if (!price) return null;
  switch (price.kind) {
    case 'free':
      return 0;
    case 'unknown':
    case 'paid-rate-unknown':
      return null;
    case 'paid': {
      const cost = stepsCost(price.steps, minutes);
      return cost === null ? null : Math.min(cost, price.dailyMax ?? Infinity);
    }
  }
}

function totalCost(charges: (number | null)[]): StayCost {
  if (charges.some((charge) => charge === null)) return { kind: 'unknown' };
  const paid = (charges as number[]).filter((charge) => charge > 0);
  const amount = roundCents(paid.reduce((sum, charge) => sum + charge, 0));
  if (paid.length === 0) return { kind: 'free' };
  return paid.length === 1 ? { kind: 'exact', amount } : { kind: 'estimate', amount };
}

function costForStay(cost: StayCost): string {
  switch (cost.kind) {
    case 'free':
      return 'Free for your whole stay';
    case 'exact':
      return `${formatMoney(cost.amount)} for your stay`;
    case 'estimate':
      return `About ${formatMoney(cost.amount)} for your stay (estimate)`;
    case 'unknown':
      return 'Allowed for your stay · cost unconfirmed';
  }
}

function costUntilThen(cost: StayCost): string {
  switch (cost.kind) {
    case 'free':
      return 'free until then';
    case 'exact':
      return formatMoney(cost.amount);
    case 'estimate':
      return `about ${formatMoney(cost.amount)}`;
    case 'unknown':
      return 'cost unconfirmed';
  }
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
