import { centroid } from './geometry.ts';
import { EVERY_DAY, parseDays, parseTimeRange } from './schedule.ts';
import { clean, isoDate, positiveOrNull, titleCase } from './text.ts';
import type {
  NormalizeOutcome,
  ParkingRule,
  PriceStep,
  SourceFeature,
  TimeWindow,
  Weekday,
} from './types.ts';

export interface KitchenerStreetProps {
  OBJECTID: number;
  PARKINGONSTREETID: number;
  STREET: string | null;
  NUM_SPACES: number | null;
  PARKING_COST: string | null;
  PAYMENT_METHOD: string | null;
  HOURS: string | null;
  DAYS: string | null;
  STATUS: string | null;
  UPDATE_DATE: number | null;
}

export interface KitchenerLotProps {
  OBJECTID: number;
  PARKINGFACILITYID: number;
  PARKING_FACILITY: string | null;
  LOT_NUMBER: string | null;
  SUBCATEGORY: string | null;
  STREET: string | null;
  NUM_SPACES: number | null;
  ACCESSIBLE_SPACES: number | null;
  PARKING_COST: string | null;
  PAYMENT_METHOD: string | null;
  MAX_RATE: number | null;
  HOURS: string | null;
  DAYS: string | null;
  STATUS: string | null;
  DIVISION_RESPONSIBLE: string | null;
  UPDATE_DATE: number | null;
}

const ALL_SUNDAY: TimeWindow = { days: [0], start: '00:00', end: '24:00' };

export function normalizeKitchenerStreet(feature: SourceFeature<KitchenerStreetProps>): NormalizeOutcome {
  const p = feature.properties;
  const id = `kitchener-street-${String(p.PARKINGONSTREETID)}`;
  const name = titleCase(p.STREET) || 'Unnamed street';

  if (clean(p.STATUS).toUpperCase() !== 'ACTIVE') {
    return excluded(id, name, `Status is ${clean(p.STATUS) || 'missing'}`);
  }
  if (!feature.geometry) return excluded(id, name, 'No geometry');

  const cost = clean(p.PARKING_COST).toUpperCase();
  if (cost === 'UNKNOWN') return excluded(id, name, 'Cost is listed as UNKNOWN');

  const problems: string[] = [];
  const when = parseWindow(p.HOURS, p.DAYS, null, problems);
  const rules: ParkingRule[] = [];
  const freeLimit = /^(\d+)\s*(HOURS?|HRS?|MINS?|MINUTES?)\s+FREE$/.exec(cost);

  if (freeLimit) {
    const unitMin = freeLimit[2]?.startsWith('H') ? 60 : 1;
    rules.push({ when, access: 'public', price: { kind: 'free' }, maxStayMin: Number(freeLimit[1]) * unitMin });
  } else if (cost === 'FREE') {
    rules.push({ when, access: 'public', price: { kind: 'free' }, maxStayMin: null });
  } else if (cost === '' && clean(p.PAYMENT_METHOD).toUpperCase() === 'METERED') {
    rules.push({ when, access: 'public', price: { kind: 'paid-rate-unknown' }, maxStayMin: null });
  } else {
    problems.push(`Unrecognized cost "${cost}"`);
  }

  return {
    kind: 'option',
    problems,
    option: {
      id,
      city: 'Kitchener',
      kind: 'street',
      name,
      street: name,
      position: centroid(feature.geometry),
      spaces: positiveOrNull(p.NUM_SPACES),
      accessibleSpaces: null,
      rules,
      rulesStatus: 'stated',
      openHours: null,
      notes: [],
      source: {
        dataset: 'kitchener-on-street',
        objectId: p.OBJECTID,
        updated: isoDate(p.UPDATE_DATE),
        rawText: rawText(p.PARKING_COST, p.PAYMENT_METHOD, p.HOURS, p.DAYS),
      },
      override: null,
    },
  };
}

export function normalizeKitchenerLot(feature: SourceFeature<KitchenerLotProps>): NormalizeOutcome {
  const p = feature.properties;
  const id = `kitchener-lot-${String(p.PARKINGFACILITYID)}`;
  const facility = titleCase(p.PARKING_FACILITY);
  const lotNumber = /^LOT\s+(\w+)$/i.exec(clean(p.LOT_NUMBER))?.[1];
  const name = lotNumber ? `${facility} (Lot ${lotNumber.toUpperCase()})` : facility;

  if (!facility) return excluded(id, 'Unnamed lot', 'No facility name in source');
  if (clean(p.STATUS).toUpperCase() !== 'ACTIVE') {
    return excluded(id, name, `Status is ${clean(p.STATUS) || 'missing'}`);
  }
  if (clean(p.DIVISION_RESPONSIBLE).toUpperCase() === 'NON-CITY') {
    return excluded(id, name, 'Not city-run (division NON-CITY)');
  }
  if (!feature.geometry) return excluded(id, name, 'No geometry');

  const problems: string[] = [];
  const notes: string[] = [];
  const when = parseWindow(p.HOURS, p.DAYS, EVERY_DAY, problems);
  const rules = parseLotCost(clean(p.PARKING_COST).toUpperCase(), p.MAX_RATE, when, problems, notes);

  return {
    kind: 'option',
    problems,
    option: {
      id,
      city: 'Kitchener',
      kind: /SURFACE/i.test(clean(p.SUBCATEGORY)) ? 'lot' : 'garage',
      name,
      street: titleCase(p.STREET) || null,
      position: centroid(feature.geometry),
      spaces: positiveOrNull(p.NUM_SPACES),
      accessibleSpaces: typeof p.ACCESSIBLE_SPACES === 'number' && p.ACCESSIBLE_SPACES >= 0 ? p.ACCESSIBLE_SPACES : null,
      rules,
      rulesStatus: 'stated',
      // HOURS in this layer mixes pricing and opening hours, so it only feeds the rules.
      openHours: null,
      notes,
      source: {
        dataset: 'kitchener-public-lots',
        objectId: p.OBJECTID,
        updated: isoDate(p.UPDATE_DATE),
        rawText: rawText(p.PARKING_COST, p.HOURS, p.DAYS),
      },
      override: null,
    },
  };
}

const AMOUNT = String.raw`\$?(\d*\.?\d+)`;

/** Each clause of a Kitchener lot cost, e.g. "2.25 PER HOUR / SUNDAY FREE" has two. `$N` is an amount. */
const COST_CLAUSES: { template: string; steps: (amounts: number[]) => PriceStep[]; note?: (amounts: number[]) => string }[] = [
  {
    template: String.raw`$N PER HOUR`,
    steps: ([rate = NaN]) => [step(0, null, rate, 60)],
  },
  {
    template: String.raw`$N THEATRE PARKING $N EXCEPT MATINEE`,
    steps: ([rate = NaN]) => [step(0, null, rate, 60)],
    note: ([, flat = NaN]) => `Theatre event flat rate $${flat.toFixed(2)}, except matinees`,
  },
  {
    template: String.raw`(?:0-2 HRS|FIRST 2 HRS) $N EACH \.5 HR THEREAFTER $N`,
    steps: ([firstTwoHours = NaN, halfHour = NaN]) => [step(0, 120, firstTwoHours, 120), step(120, null, halfHour, 30)],
  },
  {
    template: String.raw`1ST \.5 HR $N, 2ND \.5 HR $N EACH \.5 HR THEREAFTER $N`,
    steps: ([first = NaN, second = NaN, after = NaN]) => [step(0, 30, first, 30), step(30, 60, second, 30), step(60, null, after, 30)],
  },
];

const COST_PATTERNS = COST_CLAUSES.map((clause) => ({
  ...clause,
  pattern: new RegExp(`^${clause.template.replaceAll('$N', () => AMOUNT)}$`),
}));

function parseLotCost(
  cost: string,
  maxRate: number | null,
  when: TimeWindow | null,
  problems: string[],
  notes: string[],
): ParkingRule[] {
  if (cost === 'FREE') return [{ when, access: 'public', price: { kind: 'free' }, maxStayMin: null }];
  if (cost === 'FREE FOR USE WHILE AT FACILITY') {
    return [{ when, access: 'facility-visitors', price: { kind: 'free' }, maxStayMin: null }];
  }

  let steps: PriceStep[] | null = null;
  let sundayFree = false;

  for (const clause of cost.split('/').map((c) => c.trim().replace(/\$\s+/g, '$')).filter(Boolean)) {
    if (/^SUNDAYS? FREE$/.test(clause)) {
      sundayFree = true;
      continue;
    }
    const match = COST_PATTERNS.map((c) => ({ c, m: c.pattern.exec(clause) })).find((x) => x.m);
    if (!match?.m) {
      problems.push(`Unrecognized cost clause "${clause}"`);
      continue;
    }
    const amounts = match.m.slice(1).map(Number);
    steps = match.c.steps(amounts);
    if (match.c.note) notes.push(match.c.note(amounts));
  }

  if (!steps) {
    if (problems.length === 0) problems.push(`No price in cost "${cost}"`);
    return [];
  }
  if (steps.some((s) => !Number.isFinite(s.amount))) problems.push(`Invalid amount in cost "${cost}"`);

  const paidWhen = when && { ...when, days: when.days.filter((day: Weekday) => !(sundayFree && day === 0)) };
  const rules: ParkingRule[] = [
    { when: paidWhen, access: 'public', price: { kind: 'paid', steps, dailyMax: positiveOrNull(maxRate) }, maxStayMin: null },
  ];
  if (sundayFree) rules.push({ when: ALL_SUNDAY, access: 'public', price: { kind: 'free' }, maxStayMin: null });
  return rules;
}

function parseWindow(
  hoursText: string | null,
  daysText: string | null,
  defaultDays: Weekday[] | null,
  problems: string[],
): TimeWindow | null {
  const hours = clean(hoursText);
  const daysLabel = clean(daysText);
  // Some park lots list days but no hours; days alone don't make a usable window.
  if (!hours) return null;
  const range = parseTimeRange(hours);
  const days = daysLabel ? parseDays(daysLabel) : defaultDays;
  if (!range) problems.push(`Unrecognized hours "${hours}"`);
  if (!days) problems.push(daysLabel ? `Unrecognized days "${daysLabel}"` : `Hours "${hours}" given without days`);
  return range && days ? { days, ...range } : null;
}

function step(fromMin: number, toMin: number | null, amount: number, blockMin: number): PriceStep {
  return { fromMin, toMin, amount, blockMin };
}

function rawText(...parts: (string | null)[]): string {
  return parts.map(clean).filter(Boolean).join(' · ');
}

function excluded(id: string, name: string, reason: string): NormalizeOutcome {
  return { kind: 'excluded', id, name, reason };
}
