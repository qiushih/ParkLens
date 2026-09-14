import { describe, expect, it } from 'vitest';
import type { ParkingDataset, ParkingOption, ParkingRule } from '../data/types';
import { distanceMetres, estimateWalkMinutes, findNearby } from './nearby';

const FREE_2H: ParkingRule = { when: null, access: 'public', price: { kind: 'free' }, maxStayMin: 120 };
const DESTINATION = { lat: 43.45, lng: -80.49 };

/** An option `northM` metres north of the destination. */
function option(id: string, northM: number, overrides: Partial<ParkingOption> = {}): ParkingOption {
  return {
    id,
    city: 'Kitchener',
    kind: 'street',
    name: id,
    street: id,
    position: [DESTINATION.lng, DESTINATION.lat + northM / 111_195],
    spaces: null,
    accessibleSpaces: null,
    rules: [FREE_2H],
    rulesStatus: 'stated',
    openHours: null,
    notes: [],
    source: { dataset: 'kitchener-on-street', objectId: 1, updated: null, rawText: '' },
    override: null,
    ...overrides,
  };
}

const dataset = (options: ParkingOption[]): ParkingDataset => ({ sources: [], options });

describe('distanceMetres', () => {
  it('measures north–south distance', () => {
    expect(distanceMetres({ lat: 43.45, lng: -80.49 }, { lat: 43.46, lng: -80.49 })).toBeCloseTo(1112, 0);
  });

  it('is zero for the same point', () => {
    expect(distanceMetres(DESTINATION, DESTINATION)).toBe(0);
  });
});

describe('estimateWalkMinutes', () => {
  it.each([
    [0, 1],
    [30, 1],
    [400, 7], // 400 m × 1.3 ÷ 80 m/min = 6.5
    [920, 15],
  ])('%d m → %d min', (metres, minutes) => {
    expect(estimateWalkMinutes(metres)).toBe(minutes);
  });
});

describe('findNearby', () => {
  it('sorts nearest first and drops options beyond the walking limit', () => {
    const result = findNearby(dataset([option('far', 900), option('near', 100), option('too-far', 1200)]), DESTINATION);
    expect(result.map((r) => r.option.id)).toEqual(['near', 'far']);
    expect(result[0]).toMatchObject({ walkMin: 2 });
  });

  it('collapses records for the same place with the same rules to the nearest one', () => {
    const result = findNearby(
      dataset([
        option('segment-far', 300, { name: 'Queen St N' }),
        option('segment-near', 120, { name: 'Queen St N' }),
        option('different-rules', 200, { name: 'Queen St N', rules: [{ ...FREE_2H, maxStayMin: 60 }] }),
      ]),
      DESTINATION,
    );
    expect(result.map((r) => r.option.id)).toEqual(['segment-near', 'different-rules']);
  });

  it('keeps unverified records separate from stated ones with the same name', () => {
    const result = findNearby(
      dataset([option('stated', 100, { name: 'Roy St' }), option('unverified', 50, { name: 'Roy St', rulesStatus: 'unverified' })]),
      DESTINATION,
    );
    expect(result).toHaveLength(2);
  });

  it('returns nothing when nothing is in range', () => {
    expect(findNearby(dataset([option('far', 5000)]), DESTINATION)).toEqual([]);
  });
});
