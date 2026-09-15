import { describe, expect, it } from 'vitest';
import { PARKING_DATASET } from '../data/bundled';
import { minutesOf } from '../data/schedule';
import type { ParkingOption, PriceStep, Weekday } from '../data/types';
import { clockAfter, describeStay, evaluateStay, stepsCost, type StayRequest } from './stay';

const [SUN, MON, FRI, SAT] = [0, 1, 5, 6] as const;

function optionById(id: string): ParkingOption {
  const option = PARKING_DATASET.options.find((o) => o.id === id);
  if (!option) throw new Error(`No option ${id} in the bundled dataset`);
  return option;
}

const stay = (day: Weekday, time: string, durationMin: number): StayRequest => ({ day, minute: minutesOf(time), durationMin });

function evaluate(id: string, day: Weekday, time: string, durationMin: number) {
  const request = stay(day, time, durationMin);
  const evaluation = evaluateStay(optionById(id), request);
  return { ...evaluation, headline: describeStay(evaluation, request) };
}

describe('evaluateStay (bundled dataset)', () => {
  it.each([
    // Kitchener surface lots: $2.80/hr weekdays 8–5, $13.95 max
    ['Lot 3, Mon 10:00 for 3 hr', 'kitchener-lot-2013', MON, '10:00', 180, 'fits', { kind: 'exact', amount: 8.4 }, '$8.40 for your stay'],
    ['Lot 3, Mon 10:00 for 6 hr (daily max)', 'kitchener-lot-2013', MON, '10:00', 360, 'fits', { kind: 'exact', amount: 13.95 }, '$13.95 for your stay'],
    ['Lot 3, Sat 10:00 for 4 hr', 'kitchener-lot-2013', SAT, '10:00', 240, 'fits', { kind: 'free' }, 'Free for your whole stay'],
    ['Lot 3, Mon 16:00 for 2 hr (evening not listed)', 'kitchener-lot-2013', MON, '16:00', 120, 'unknown', { kind: 'unknown' }, "Rules after 5:00 p.m. aren't listed"],
    ['Lot 7, Mon 10:00 for 3 hr (2-hour limit)', 'kitchener-lot-2090', MON, '10:00', 180, 'partial', { kind: 'exact', amount: 5.6 }, '2 hr max · move by 12:00 p.m. · $5.60'],
    ['Lot 25, Mon 10:00 for 90 min (first hour free)', 'kitchener-lot-24872', MON, '10:00', 90, 'fits', { kind: 'exact', amount: 2.8 }, '$2.80 for your stay'],

    // Kitchener garages
    ['Charles & Benton, Mon 10:00 for 3 hr', 'kitchener-lot-3130', MON, '10:00', 180, 'fits', { kind: 'exact', amount: 8.3 }, '$8.30 for your stay'],
    ['Charles & Benton, Mon 16:00 for 2 hr (day rate into evening cap)', 'kitchener-lot-3130', MON, '16:00', 120, 'fits', { kind: 'estimate', amount: 8.8 }, 'About $8.80 for your stay (estimate)'],
    ['Charles & Benton, Sat 23:00 for 2 hr (Saturday night into Sunday)', 'kitchener-lot-3130', SAT, '23:00', 120, 'fits', { kind: 'exact', amount: 4.4 }, '$4.40 for your stay'],
    ['City Hall, Mon 21:00 for 2 hr (closes at 10)', 'kitchener-lot-1989', MON, '21:00', 120, 'partial', { kind: 'exact', amount: 4.4 }, 'Closes at 10:00 p.m. · $4.40'],
    ['Market garage, Sun 12:00 (closed)', 'kitchener-lot-2085', SUN, '12:00', 60, 'not-allowed', { kind: 'free' }, 'Closed when you arrive'],

    // Kitchener streets
    ['Queen St N, Mon 10:00 for 3 hr (2-hour limit)', 'kitchener-street-2009', MON, '10:00', 180, 'partial', { kind: 'free' }, '2 hr max · move by 12:00 p.m. · free until then'],

    // Waterloo
    ['City Centre Lot, Mon 10:00 for 2 hr', 'waterloo-lot-11', MON, '10:00', 120, 'fits', { kind: 'free' }, 'Free for your whole stay'],
    ['City Centre Lot, Mon 10:00 for 3 hr (HonkMobile)', 'waterloo-lot-11', MON, '10:00', 180, 'fits', { kind: 'unknown' }, 'Allowed for your stay · cost unconfirmed'],
    ['City Centre Lot, Mon 15:00 for 3 hr (into free evening)', 'waterloo-lot-11', MON, '15:00', 180, 'fits', { kind: 'free' }, 'Free for your whole stay'],
    ['City Centre Lot, Fri 23:00 for 5 hr (past 3 a.m.)', 'waterloo-lot-11', FRI, '23:00', 300, 'unknown', { kind: 'unknown' }, "Rules after Sat 3:00 a.m. aren't listed"],
    ['Bauer Lot, Mon 16:00 (permit)', 'waterloo-lot-5', MON, '16:00', 120, 'not-allowed', { kind: 'free' }, 'Permit only when you arrive'],
    ['Bauer Lot, Mon 17:00 for 2 hr', 'waterloo-lot-5', MON, '17:00', 120, 'fits', { kind: 'free' }, 'Free for your whole stay'],
    ['Uptown Parkade, Sat 12:00 for 3 hr (flat rate)', 'waterloo-lot-12', SAT, '12:00', 180, 'fits', { kind: 'exact', amount: 4 }, '$4.00 for your stay'],
    ['Uptown Parkade, Mon 20:00 for 2 hr (hourly into flat)', 'waterloo-lot-12', MON, '20:00', 120, 'fits', { kind: 'estimate', amount: 8 }, 'About $8.00 for your stay (estimate)'],
  ] as const)('%s', (_label, id, day, time, durationMin, fit, cost, headline) => {
    expect(evaluate(id, day, time, durationMin)).toMatchObject({ fit, cost, headline });
  });

  it('never allows the full stay past a 2-hour limit, but keeps the allowed time', () => {
    expect(evaluate('kitchener-street-2009', MON, '10:00', 180)).toMatchObject({ allowedMin: 120, stopReason: 'max-stay' });
  });

  it('lists each stretch of a stay whose rules change', () => {
    expect(evaluate('kitchener-lot-3130', MON, '16:00', 120).segments).toEqual([
      { fromMin: 0, toMin: 60, summary: '$4.40 for the first 2 hr, then $1.95 per 30 min · $17.40 max' },
      { fromMin: 60, toMin: 120, summary: '$4.40 for the first 2 hr, then $1.95 per 30 min · $6.25 max' },
    ]);
  });

  it('treats unverified options as unknown', () => {
    expect(evaluate('kitchener-street-1932', MON, '10:00', 60)).toMatchObject({ fit: 'unknown', cost: { kind: 'unknown' } });
  });

  it('marks facility-visitor lots as restricted', () => {
    const communityCentre = PARKING_DATASET.options.find((o) => o.rules.some((r) => r.access === 'facility-visitors'));
    if (!communityCentre) throw new Error('No facility-visitor lot in the dataset');
    const request = stay(MON, '10:00', 60);
    const evaluation = evaluateStay(communityCentre, request);
    expect(evaluation.fit).toBe('restricted');
    expect(describeStay(evaluation, request)).toBe('For facility visitors only');
  });
});

describe('stepsCost', () => {
  const garage: PriceStep[] = [
    { fromMin: 0, toMin: 120, amount: 4.4, blockMin: 120 },
    { fromMin: 120, toMin: null, amount: 1.95, blockMin: 30 },
  ];
  const civic: PriceStep[] = [
    { fromMin: 0, toMin: 30, amount: 1.3, blockMin: 30 },
    { fromMin: 30, toMin: 60, amount: 1.3, blockMin: 30 },
    { fromMin: 60, toMin: 120, amount: 1.8, blockMin: 60 },
    { fromMin: 120, toMin: null, amount: 1.95, blockMin: 30 },
  ];
  const honk: PriceStep[] = [
    { fromMin: 0, toMin: 120, amount: 0, blockMin: 120 },
    { fromMin: 120, toMin: null, amount: null, blockMin: 60 },
  ];

  it.each([
    ['garage, 1 min', garage, 1, 4.4],
    ['garage, 90 min', garage, 90, 4.4],
    ['garage, 2 hr 1 min', garage, 121, 6.35],
    ['garage, 2 hr 30 min', garage, 150, 6.35],
    ['Civic District, 20 min', civic, 20, 1.3],
    ['Civic District, 90 min', civic, 90, 4.4],
    ['HonkMobile, 2 hr', honk, 120, 0],
    ['HonkMobile, 2 hr 1 min', honk, 121, null],
  ] as const)('%s → %s', (_label, steps, minutes, expected) => {
    expect(stepsCost(steps, minutes)).toBe(expected);
  });
});

describe('clockAfter', () => {
  it('adds the weekday once the stay crosses midnight', () => {
    expect(clockAfter(stay(SAT, '22:00', 180), 60)).toBe('11:00 p.m.');
    expect(clockAfter(stay(SAT, '22:00', 180), 150)).toBe('Sun 12:30 a.m.');
  });
});
