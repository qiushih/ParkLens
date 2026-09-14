import { describe, expect, it } from 'vitest';
import {
  normalizeKitchenerLot,
  normalizeKitchenerStreet,
  type KitchenerLotProps,
  type KitchenerStreetProps,
} from './kitchener.ts';
import type { NormalizeOutcome, ParkingOption, PolygonGeometry } from './types.ts';

const SQUARE: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [[[-80.49, 43.45], [-80.48, 43.45], [-80.48, 43.46], [-80.49, 43.46], [-80.49, 43.45]]],
};

const street = (props: Partial<KitchenerStreetProps> = {}) =>
  normalizeKitchenerStreet({
    geometry: SQUARE,
    properties: {
      OBJECTID: 128,
      PARKINGONSTREETID: 2009,
      STREET: 'QUEEN ST N',
      NUM_SPACES: 8,
      PARKING_COST: '2 HOURS FREE',
      PAYMENT_METHOD: ' ',
      HOURS: null,
      DAYS: null,
      STATUS: 'ACTIVE',
      UPDATE_DATE: 1492005584000,
      ...props,
    },
  });

const lot = (props: Partial<KitchenerLotProps> = {}) =>
  normalizeKitchenerLot({
    geometry: SQUARE,
    properties: {
      OBJECTID: 1,
      PARKINGFACILITYID: 2043,
      PARKING_FACILITY: 'WATER ST S',
      LOT_NUMBER: 'LOT 3',
      SUBCATEGORY: 'SURFACE LOT',
      STREET: 'WATER ST S',
      NUM_SPACES: 120,
      ACCESSIBLE_SPACES: 4,
      PARKING_COST: '2.25 PER HOUR / SUNDAY FREE',
      PAYMENT_METHOD: 'HOURLY / MONTHLY',
      MAX_RATE: 10.75,
      HOURS: '8:00 - 17:00',
      DAYS: 'Monday - Saturday',
      STATUS: 'ACTIVE',
      DIVISION_RESPONSIBLE: 'TRANSPORTATION PLANNING',
      UPDATE_DATE: 1573776000000,
      ...props,
    },
  });

function optionOf(outcome: NormalizeOutcome): ParkingOption & { problems: string[] } {
  if (outcome.kind !== 'option') throw new Error(`Expected an option, got excluded: ${outcome.reason}`);
  return { ...outcome.option, problems: outcome.problems };
}

const MON_SAT = [1, 2, 3, 4, 5, 6];
const SUNDAY_FREE = { when: { days: [0], start: '00:00', end: '24:00' }, access: 'public', price: { kind: 'free' }, maxStayMin: null };

describe('normalizeKitchenerStreet', () => {
  it('maps the record', () => {
    expect(optionOf(street())).toMatchObject({
      id: 'kitchener-street-2009',
      city: 'Kitchener',
      kind: 'street',
      name: 'Queen St N',
      street: 'Queen St N',
      position: [-80.485, 43.455],
      spaces: 8,
      source: { dataset: 'kitchener-on-street', objectId: 128, updated: '2017-04-12', rawText: '2 HOURS FREE' },
      problems: [],
    });
  });

  it.each([
    // Every cost format present in the source data.
    ['2 HOURS FREE', ' ', 120],
    ['2 Hours Free', 'METERED', 120],
    ['1 HOUR FREE', ' ', 60],
    ['30 MINS FREE', ' ', 30],
    ['FREE', null, null],
  ])('%j (payment %j) is free with max stay %j', (cost, payment, maxStayMin) => {
    const option = optionOf(street({ PARKING_COST: cost, PAYMENT_METHOD: payment }));
    expect(option.rules).toEqual([{ when: null, access: 'public', price: { kind: 'free' }, maxStayMin }]);
    expect(option.problems).toEqual([]);
  });

  it('reads stated hours and days', () => {
    const option = optionOf(street({ PARKING_COST: '2 Hours Free', HOURS: '8AM-6PM', DAYS: 'MON-FRI' }));
    expect(option.rules[0]?.when).toEqual({ days: [1, 2, 3, 4, 5], start: '08:00', end: '18:00' });
  });

  it('treats blank cost on a metered street as paid with an unknown rate', () => {
    const option = optionOf(street({ PARKING_COST: ' ', PAYMENT_METHOD: 'METERED' }));
    expect(option.rules).toEqual([{ when: null, access: 'public', price: { kind: 'paid-rate-unknown' }, maxStayMin: null }]);
  });

  it('reports a blank cost that is not metered', () => {
    expect(optionOf(street({ PARKING_COST: ' ', PAYMENT_METHOD: ' ' })).problems).toEqual(['Unrecognized cost ""']);
  });

  it.each([
    [{ PARKING_COST: 'UNKNOWN' }, 'Cost is listed as UNKNOWN'],
    [{ STATUS: 'HISTORIC' }, 'Status is HISTORIC'],
  ])('excludes %j', (props, reason) => {
    expect(street(props)).toMatchObject({ kind: 'excluded', reason });
  });
});

describe('normalizeKitchenerLot', () => {
  it('maps the record, naming it with its lot number', () => {
    expect(optionOf(lot())).toMatchObject({
      id: 'kitchener-lot-2043',
      kind: 'lot',
      name: 'Water St S (Lot 3)',
      street: 'Water St S',
      spaces: 120,
      accessibleSpaces: 4,
      source: { dataset: 'kitchener-public-lots', updated: '2019-11-15', rawText: '2.25 PER HOUR / SUNDAY FREE · 8:00 - 17:00 · Monday - Saturday' },
      problems: [],
    });
  });

  it('omits non-numeric lot numbers and marks garages', () => {
    expect(optionOf(lot({ PARKING_FACILITY: 'CITY HALL GARAGE', LOT_NUMBER: 'CITY HALL', SUBCATEGORY: 'UNDERGROUND' }))).toMatchObject({
      name: 'City Hall Garage',
      kind: 'garage',
    });
  });

  it.each(['2.25 PER HOUR / SUNDAY FREE', '2.25 PER HOUR / SUNDAYS FREE'])('%j: paid Mon–Sat, free Sunday', (cost) => {
    expect(optionOf(lot({ PARKING_COST: cost })).rules).toEqual([
      {
        when: { days: MON_SAT, start: '08:00', end: '17:00' },
        access: 'public',
        price: { kind: 'paid', steps: [{ fromMin: 0, toMin: null, amount: 2.25, blockMin: 60 }], dailyMax: 10.75 },
        maxStayMin: null,
      },
      SUNDAY_FREE,
    ]);
  });

  it('"2.25 PER HOUR" has no Sunday rule', () => {
    expect(optionOf(lot({ PARKING_COST: '2.25 PER HOUR' })).rules).toHaveLength(1);
  });

  it('removes Sunday from the paid days when Sundays are free', () => {
    const option = optionOf(lot({ PARKING_COST: '2.75 PER HOUR / SUNDAYS FREE', DAYS: 'Monday - Sunday', HOURS: '8:00 - 24:00' }));
    expect(option.rules[0]?.when).toEqual({ days: MON_SAT, start: '08:00', end: '24:00' });
    expect(option.rules[1]).toEqual(SUNDAY_FREE);
  });

  it.each([
    ['0-2 HRS $3.20 EACH .5 HR THEREAFTER $1.65', [{ fromMin: 0, toMin: 120, amount: 3.2, blockMin: 120 }, { fromMin: 120, toMin: null, amount: 1.65, blockMin: 30 }]],
    ['FIRST 2 HRS 3.20 EACH .5 HR THEREAFTER $1.65 / SUNDAY FREE', [{ fromMin: 0, toMin: 120, amount: 3.2, blockMin: 120 }, { fromMin: 120, toMin: null, amount: 1.65, blockMin: 30 }]],
    [
      '1ST .5 HR $1.05, 2ND .5 HR $1.05 EACH .5 HR THEREAFTER $1.65',
      [{ fromMin: 0, toMin: 30, amount: 1.05, blockMin: 30 }, { fromMin: 30, toMin: 60, amount: 1.05, blockMin: 30 }, { fromMin: 60, toMin: null, amount: 1.65, blockMin: 30 }],
    ],
  ])('tiered %j', (cost, steps) => {
    const option = optionOf(lot({ PARKING_COST: cost, MAX_RATE: 14.5 }));
    expect(option.rules[0]?.price).toEqual({ kind: 'paid', steps, dailyMax: 14.5 });
    expect(option.problems).toEqual([]);
  });

  it.each([
    ['2.25 THEATRE PARKING $9.00 EXCEPT MATINEE', 'Theatre event flat rate $9.00, except matinees'],
    ['2.25 THEATRE PARKING $7.50 EXCEPT MATINEE', 'Theatre event flat rate $7.50, except matinees'],
  ])('%j is hourly with a theatre note', (cost, note) => {
    const option = optionOf(lot({ PARKING_COST: cost }));
    expect(option.rules[0]?.price).toMatchObject({ kind: 'paid', steps: [{ amount: 2.25, blockMin: 60 }] });
    expect(option.notes).toEqual([note]);
  });

  it.each([
    ['FREE', 'public'],
    ['FREE FOR USE WHILE AT FACILITY', 'facility-visitors'],
  ])('%j is free for %s', (cost, access) => {
    const option = optionOf(lot({ PARKING_COST: cost, PAYMENT_METHOD: 'FREE', MAX_RATE: null, HOURS: null, DAYS: null }));
    expect(option.rules).toEqual([{ when: null, access, price: { kind: 'free' }, maxStayMin: null }]);
  });

  it('applies hours without days to every day', () => {
    const option = optionOf(lot({ PARKING_COST: 'FREE', HOURS: '6:00 - 14:30', DAYS: null }));
    expect(option.rules[0]?.when).toEqual({ days: [0, 1, 2, 3, 4, 5, 6], start: '06:00', end: '14:30' });
  });

  it.each([
    ['24 hours', { start: '00:00', end: '24:00' }],
    ['8:00 am - 5:00 pm', { start: '08:00', end: '17:00' }],
  ])('reads hours %j', (hours, range) => {
    expect(optionOf(lot({ HOURS: hours })).rules[0]?.when).toMatchObject(range);
  });

  it('reports costs and hours it cannot represent, for an override to fix', () => {
    expect(optionOf(lot({ PARKING_COST: 'MONDAY TO FRIDAY FIRST HOUR ONLY FREE/ $ 2.70 PER HOUR / $13.40 DAILY MAX' })).problems).toEqual([
      'Unrecognized cost clause "MONDAY TO FRIDAY FIRST HOUR ONLY FREE"',
      'Unrecognized cost clause "$13.40 DAILY MAX"',
    ]);
    expect(optionOf(lot({ HOURS: '8:00-24:00 M-S/12:00-24:00 SU' })).problems).toEqual([
      'Unrecognized hours "8:00-24:00 M-S/12:00-24:00 SU"',
    ]);
  });

  it.each([
    [{ STATUS: 'HISTORIC' }, 'Status is HISTORIC'],
    [{ DIVISION_RESPONSIBLE: 'NON-CITY' }, 'Not city-run (division NON-CITY)'],
    [{ PARKING_FACILITY: null }, 'No facility name in source'],
  ])('excludes %j', (props, reason) => {
    expect(lot(props)).toMatchObject({ kind: 'excluded', reason });
  });
});
