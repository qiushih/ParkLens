import { describe, expect, it } from 'vitest';
import type { NormalizeOutcome, ParkingOption, PolygonGeometry } from './types.ts';
import { normalizeWaterlooLot, type WaterlooLotProps } from './waterloo.ts';

const SQUARE: PolygonGeometry = {
  type: 'Polygon',
  coordinates: [[[-80.53, 43.46], [-80.52, 43.46], [-80.52, 43.47], [-80.53, 43.47], [-80.53, 43.46]]],
};

const waterlooLot = (props: Partial<WaterlooLotProps> = {}) =>
  normalizeWaterlooLot(
    {
      geometry: SQUARE,
      properties: {
        OBJECTID: 11,
        NAME: 'City Centre Lot',
        ADDRESS: '100 REGINA ST S',
        OWNER: 'City of Waterloo',
        CLASS: '2 Hour Free Parking',
        RESERVED: 'N',
        ACCESSIBLE: 'N',
        DESCR: '2 Hour Free Parking Mon-Fri 8am-5pm',
        CAPACITY: null,
        ...props,
      },
    },
    '2018-01-24',
  );

function optionOf(outcome: NormalizeOutcome): ParkingOption & { problems: string[] } {
  if (outcome.kind !== 'option') throw new Error(`Expected an option, got excluded: ${outcome.reason}`);
  return { ...outcome.option, problems: outcome.problems };
}

const MON_FRI = [1, 2, 3, 4, 5];
const free2h = (end: string) => ({ when: { days: MON_FRI, start: '08:00', end }, access: 'public', price: { kind: 'free' }, maxStayMin: 120 });
const permit = (start: string, end: string) => ({ when: { days: MON_FRI, start, end }, access: 'permit', price: null, maxStayMin: null });
const payAndDisplay = {
  when: { days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '21:00' },
  access: 'public',
  price: { kind: 'paid', steps: [{ fromMin: 0, toMin: null, amount: 2.5, blockMin: 60 }], dailyMax: null },
  maxStayMin: null,
};

describe('normalizeWaterlooLot', () => {
  it('maps the record', () => {
    expect(optionOf(waterlooLot())).toMatchObject({
      id: 'waterloo-lot-11',
      city: 'Waterloo',
      kind: 'lot',
      name: 'City Centre Lot',
      street: 'Regina St S',
      position: [-80.525, 43.465],
      spaces: null,
      source: { dataset: 'waterloo-city-lots', objectId: 11, updated: '2018-01-24', rawText: '2 Hour Free Parking Mon-Fri 8am-5pm' },
      problems: [],
    });
  });

  it.each([
    // Every description in the source data, except those on excluded records.
    ['Permit Parking Mon-Fri 8am-5pm', [permit('08:00', '17:00')], []],
    ['2 Hour Free Parking Mon-Fri 8am-6pm', [free2h('18:00')], []],
    ['Permit Parking Mon-Fri 8am-6pm', [permit('08:00', '18:00')], []],
    ['2 Hour Free Parking Mon-Fri 8am-5pm', [free2h('17:00')], []],
    ['Permit Parking Mon-Fri 8am-6pm; Overnight Permits; 24h Permits', [permit('08:00', '18:00')], ['Overnight Permits', '24h Permits']],
    ['Permit Parking Mon-Fri 8am-6pm; Overnight Permits March-November Only', [permit('08:00', '18:00')], ['Overnight Permits March-November Only']],
    ['Permit Parking Mon-Fri 9am-5pm', [permit('09:00', '17:00')], []],
    ['Permit Parking Mon-Fri 9am-5pm; Pay & Display Machine Mon-Sat 9am-9pm $2.50/hr', [permit('09:00', '17:00'), payAndDisplay], []],
    ['Pay & Display Machine  Mon-Sat 9am-9pm $2.50/hr', [payAndDisplay], []],
    ['2 Hour Free Parking Mon-Fri 8am-5pm;  Overnight Parking Permitted in Park It and Leave It Spaces Only', [free2h('17:00')], ['Overnight Parking Permitted in Park It and Leave It Spaces Only']],
    ['Paul Puncher Permit Parking Mon-Fri 8am-6pm', [permit('08:00', '18:00')], ['Permit parking is for Paul Puncher permit holders']],
    ['2 Hour Free Parking Mon-Fri 8am-5pm; "S" Permit', [free2h('17:00')], ['"S" Permit']],
  ])('%j', (descr, rules, notes) => {
    const option = optionOf(waterlooLot({ DESCR: descr }));
    expect(option.rules).toEqual(rules);
    expect(option.notes).toEqual(notes);
    expect(option.problems).toEqual([]);
  });

  it('reports the truncated Uptown Parkade description, for an override to fix', () => {
    const descr =
      '$3.00/hr Maximum$16.00/day Mon-Fri 8am-9pm; 24 Hour Permits; Overnight/Weekend Permits; $3 flat rate Mon-Fri 9pm-Midnight; $3 flat rate Mon-Fri Midnight-8am; Sat & Sun $3 flat rate - add to permit det';
    const option = optionOf(waterlooLot({ NAME: 'Uptown Parkade', DESCR: descr }));
    expect(option.kind).toBe('garage');
    expect(option.problems).toHaveLength(4);
  });

  it('reads space counts and notes from capacity and accessibility', () => {
    const option = optionOf(
      waterlooLot({ CAPACITY: '118 Permit and Pay and Display (combined with adjacent lot)', ACCESSIBLE: 'Y' }),
    );
    expect(option.spaces).toBe(118);
    expect(option.notes).toEqual(['Space count is shared with an adjacent lot', 'Accessible parking available']);
  });

  it.each([
    [{ OWNER: 'Private' }, 'Owner is Private'],
    [{ CLASS: 'Motorcycle Parking' }, 'Motorcycle parking only'],
    [{ RESERVED: 'Y' }, 'Reserved parking'],
    [{ DESCR: '' }, null],
  ])('excludes or flags %j', (props, reason) => {
    const outcome = waterlooLot(props);
    if (reason) expect(outcome).toMatchObject({ kind: 'excluded', reason });
    else expect(optionOf(outcome).problems).toEqual(['No parking rules in description']);
  });
});
