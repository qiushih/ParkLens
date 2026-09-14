import { describe, expect, it } from 'vitest';
import { OVERRIDES } from './overrides.ts';
import { ruleAt } from './rules.ts';
import { minutesOf } from './schedule.ts';
import type { ParkingRule, Weekday } from './types.ts';

const [SUN, MON, FRI, SAT] = [0, 1, 5, 6] as const;

function rulesOf(id: string): ParkingRule[] {
  const rules = OVERRIDES[id]?.patch?.rules;
  if (!rules) throw new Error(`No override rules for ${id}`);
  return rules;
}

/** What applies at a moment: the daily max for paid rules, the price kind otherwise, or null if unknown. */
function chargeAt(id: string, day: Weekday, time: string): number | string | null {
  const price = ruleAt(rulesOf(id), day, minutesOf(time))?.price;
  if (!price) return null;
  return price.kind === 'paid' ? (price.dailyMax ?? 'paid') : price.kind;
}

const CHARLES_AND_BENTON = 'kitchener-lot-3130'; // evening cap, Sunday free
const CITY_HALL = 'kitchener-lot-1989'; // evening cap, no Sunday rule

describe('Kitchener garage evening cap: Monday to Saturday, 5 p.m. to 5:59 a.m.', () => {
  it.each([
    ['Friday 23:00', FRI, '23:00', 6.25],
    ['Saturday 03:00 (Friday night)', SAT, '03:00', 6.25],
    ['Saturday 06:00', SAT, '06:00', 17.4],
    ['Saturday 17:00', SAT, '17:00', 6.25],
    ['Sunday 00:00 (Saturday night)', SUN, '00:00', 6.25],
    ['Sunday 05:59 (Saturday night)', SUN, '05:59', 6.25],
    ['Sunday 06:00', SUN, '06:00', 'free'],
    ['Sunday 23:00', SUN, '23:00', 'free'],
    ['Monday 00:00 (Sunday night)', MON, '00:00', 17.4],
    ['Monday 05:59 (Sunday night)', MON, '05:59', 17.4],
    ['Monday 17:00', MON, '17:00', 6.25],
  ] as const)('Charles & Benton, %s → %s', (_label, day, time, expected) => {
    expect(chargeAt(CHARLES_AND_BENTON, day, time)).toBe(expected);
  });

  it.each([
    ['Sunday 03:00 (Saturday night)', SUN, '03:00', 6.25],
    ['Sunday 12:00', SUN, '12:00', 17.4],
    ['Sunday 23:00 (no Sunday evening cap)', SUN, '23:00', 17.4],
    ['Monday 03:00 (Sunday night)', MON, '03:00', 17.4],
  ] as const)('City Hall, %s → %s', (_label, day, time, expected) => {
    expect(chargeAt(CITY_HALL, day, time)).toBe(expected);
  });
});

describe('Waterloo uptown lots: free evenings and weekends until 3 a.m.', () => {
  const CITY_CENTRE = 'waterloo-lot-11';

  it.each([
    ['Friday 23:00', FRI, '23:00', 'free'],
    ['Saturday 02:59 (Friday night)', SAT, '02:59', 'free'],
    ['Saturday 03:00 (overnight registration)', SAT, '03:00', null],
    ['Saturday 06:00', SAT, '06:00', 'free'],
    ['Sunday 23:00', SUN, '23:00', 'free'],
    ['Monday 02:00 (Sunday night)', MON, '02:00', 'free'],
    ['Monday 04:00 (overnight registration)', MON, '04:00', null],
    ['Monday 07:00 (not stated)', MON, '07:00', null],
  ] as const)('%s → %s', (_label, day, time, expected) => {
    expect(chargeAt(CITY_CENTRE, day, time)).toBe(expected);
  });

  it('allows stays over 2 hours on weekdays, with the charge after 2 hours left unconfirmed', () => {
    const rule = ruleAt(rulesOf(CITY_CENTRE), MON, minutesOf('10:00'));
    expect(rule).toEqual({
      when: { days: [1, 2, 3, 4, 5], start: '08:00', end: '17:00' },
      access: 'public',
      price: {
        kind: 'paid',
        steps: [
          { fromMin: 0, toMin: 120, amount: 0, blockMin: 120 },
          { fromMin: 120, toMin: null, amount: null, blockMin: 60 },
        ],
        dailyMax: null,
      },
      maxStayMin: null,
    });
    expect(OVERRIDES[CITY_CENTRE]?.patch?.notes?.[0]).toMatch(/HonkMobile.*\$3\.50\/hour.*doesn't say whether the first 2 hours/);
  });
});

describe('Kitchener formerly metered street segments', () => {
  const unverified = Object.entries(OVERRIDES).filter(([, override]) => override.patch?.rulesStatus === 'unverified');

  it('are all 45 marked unverified with unknown pricing, never free', () => {
    expect(unverified).toHaveLength(45);
    for (const [id, override] of unverified) {
      expect(id).toMatch(/^kitchener-street-/);
      expect(override.patch?.rules).toEqual([{ when: null, access: 'public', price: { kind: 'unknown' }, maxStayMin: null }]);
      expect(override.patch?.notes?.[0]).toMatch(/300 free, two-hour.*unverified/);
    }
  });
});
