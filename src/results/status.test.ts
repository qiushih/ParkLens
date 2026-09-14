import { describe, expect, it } from 'vitest';
import { PARKING_DATASET } from '../data/bundled';
import { minutesOf } from '../data/schedule';
import type { ParkingOption, Price, Weekday } from '../data/types';
import { describePrice, formatDuration, statusAt } from './status';

const [SUN, MON, SAT] = [0, 1, 6] as const;

function optionById(id: string): ParkingOption {
  const option = PARKING_DATASET.options.find((o) => o.id === id);
  if (!option) throw new Error(`No option ${id} in the bundled dataset`);
  return option;
}

const status = (id: string, day: Weekday, time: string) => statusAt(optionById(id), day, minutesOf(time));

describe('statusAt (bundled dataset)', () => {
  it.each([
    // Kitchener surface lots
    ['Lot 3, Monday 10:00', 'kitchener-lot-2013', MON, '10:00', 'available', '$2.80/hr · $13.95 max'],
    ['Lot 3, Saturday', 'kitchener-lot-2013', SAT, '10:00', 'available', 'Free'],
    ['Lot 3, Monday evening (not stated)', 'kitchener-lot-2013', MON, '20:00', 'unknown', "Rules for this time aren't listed"],
    ['Lot 7, Monday (2-hour limit)', 'kitchener-lot-2090', MON, '10:00', 'available', '$2.80/hr · 2 hr max'],
    ['Lot 25, Monday', 'kitchener-lot-24872', MON, '10:00', 'available', 'Free for the first 1 hr, then $2.80/hr · $13.95 max'],
    ['Lot 25, Saturday (outside open hours)', 'kitchener-lot-24872', SAT, '10:00', 'closed', 'Closed'],

    // Kitchener garages
    ['Charles & Benton, Monday 10:00', 'kitchener-lot-3130', MON, '10:00', 'available', '$4.40 for the first 2 hr, then $1.95 per 30 min · $17.40 max'],
    ['Charles & Benton, Saturday night', 'kitchener-lot-3130', SAT, '23:00', 'available', '$4.40 for the first 2 hr, then $1.95 per 30 min · $6.25 max'],
    ['Charles & Benton, Sunday noon', 'kitchener-lot-3130', SUN, '12:00', 'available', 'Free'],
    ['Civic District, Monday 10:00', 'kitchener-lot-5903', MON, '10:00', 'available', '$1.30 for the first 30 min, then $1.95 per 30 min after 2 hr · $17.40 max'],
    ['City Hall, Sunday 23:30 (outside open hours)', 'kitchener-lot-1989', SUN, '23:30', 'closed', 'Closed'],
    ['Market, Sunday (outside open hours)', 'kitchener-lot-2085', SUN, '12:00', 'closed', 'Closed'],

    // Kitchener streets
    ['Queen St N (2 hours free)', 'kitchener-street-2009', MON, '10:00', 'available', 'Free · 2 hr max'],
    ['Ahrens St W (formerly metered)', 'kitchener-street-1932', MON, '10:00', 'unknown', 'Rules unverified · check posted signs'],

    // Waterloo
    ['City Centre Lot, Monday 10:00', 'waterloo-lot-11', MON, '10:00', 'available', 'Free for the first 2 hr, then paid (rate unconfirmed)'],
    ['City Centre Lot, Monday evening', 'waterloo-lot-11', MON, '20:00', 'available', 'Free'],
    ['City Centre Lot, Monday 04:00 (overnight registration)', 'waterloo-lot-11', MON, '04:00', 'unknown', "Rules for this time aren't listed"],
    ['Bauer Lot, Monday 10:00', 'waterloo-lot-5', MON, '10:00', 'restricted', 'Permit only'],
    ['Bauer Lot, Monday evening', 'waterloo-lot-5', MON, '20:00', 'available', 'Free'],
    ['Uptown Parkade, Monday 10:00', 'waterloo-lot-12', MON, '10:00', 'available', '$4.00/hr · $20.50 max'],
    ['Uptown Parkade, Saturday', 'waterloo-lot-12', SAT, '12:00', 'available', '$4.00 flat'],
    ['Dupont Lot pay and display, Monday 10:00', 'waterloo-lot-10', MON, '10:00', 'available', '$3.50/hr'],
  ] as const)('%s', (_label, id, day, time, availability, summary) => {
    expect(status(id, day, time)).toEqual({ availability, summary });
  });

  it('marks facility-visitor lots as restricted', () => {
    const communityCentre = PARKING_DATASET.options.find((o) => o.rules.some((r) => r.access === 'facility-visitors'));
    expect(communityCentre && statusAt(communityCentre, MON, minutesOf('10:00'))).toEqual({
      availability: 'restricted',
      summary: 'Free for facility visitors',
    });
  });
});

describe('describePrice', () => {
  const cases: [Price, string][] = [
    [{ kind: 'free' }, 'Free'],
    [{ kind: 'unknown' }, 'Pricing unconfirmed'],
    [{ kind: 'paid-rate-unknown' }, 'Paid · rate not listed'],
    [{ kind: 'paid', steps: [{ fromMin: 0, toMin: null, amount: null, blockMin: 60 }], dailyMax: null }, 'Paid · rate unconfirmed'],
    [{ kind: 'paid', steps: [{ fromMin: 0, toMin: null, amount: 2, blockMin: 20 }], dailyMax: 12 }, '$2.00 per 20 min · $12.00 max'],
  ];

  it.each(cases)('%j → %s', (price, expected) => {
    expect(describePrice(price)).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([
    [30, '30 min'],
    [60, '1 hr'],
    [120, '2 hr'],
    [90, '1 hr 30 min'],
  ])('%d → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});
