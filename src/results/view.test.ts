import { describe, expect, it } from 'vitest';
import { PARKING_DATASET } from '../data/bundled';
import { buildNearbyView } from './view';

// Monday 2026-09-14, 3:42 p.m. in Kitchener–Waterloo.
const MONDAY_AFTERNOON = new Date('2026-09-14T19:42:00Z');
// Saturday 2026-09-19, noon.
const SATURDAY_NOON = new Date('2026-09-19T16:00:00Z');

const KITCHENER_CITY_HALL = { lat: 43.4517589, lng: -80.4924168 };
const WATERLOO_PUBLIC_SQUARE = { lat: 43.4647, lng: -80.5226 };
const ORDER = ['available', 'unknown', 'restricted', 'closed'];

describe('buildNearbyView (bundled dataset)', () => {
  it('lists nearby parking for Kitchener City Hall, available first, within walking range', () => {
    const view = buildNearbyView(PARKING_DATASET, KITCHENER_CITY_HALL, MONDAY_AFTERNOON);

    expect(view.results.length).toBeGreaterThan(0);
    expect(view.results.length).toBeLessThanOrEqual(8);
    expect(view.results.map((r) => r.name)).toContain('City Hall Garage');
    expect(view.results.every((r) => r.walkMin <= view.maxWalkMin)).toBe(true);

    const ranks = view.results.map((r) => ORDER.indexOf(r.availability));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('never mixes unverified options into the main results', () => {
    const view = buildNearbyView(PARKING_DATASET, KITCHENER_CITY_HALL, MONDAY_AFTERNOON);
    const unverifiedIds = new Set(PARKING_DATASET.options.filter((o) => o.rulesStatus === 'unverified').map((o) => o.id));

    expect(view.results.some((r) => unverifiedIds.has(r.id))).toBe(false);
    expect(view.unverified.length).toBeGreaterThan(0);
    for (const item of view.unverified) {
      expect(unverifiedIds.has(item.id)).toBe(true);
      expect(item.summary).toBe('Rules unverified · check posted signs');
    }
  });

  it('shows free weekend parking in uptown Waterloo on a Saturday', () => {
    const view = buildNearbyView(PARKING_DATASET, WATERLOO_PUBLIC_SQUARE, SATURDAY_NOON);
    const townSquare = view.results.find((r) => r.name.startsWith('The Shops at Waterloo Town Square'));
    expect(townSquare).toMatchObject({ availability: 'available', summary: 'Free' });
  });

  it('shows a lot once when its sections read the same at that time', () => {
    // Monday 6 p.m.: Town Square South's 2-hour and permit sections are both free.
    const view = buildNearbyView(PARKING_DATASET, WATERLOO_PUBLIC_SQUARE, new Date('2026-09-14T22:00:00Z'));
    const lines = view.results.map((r) => `${r.name} | ${r.summary}`);
    expect(lines.filter((line) => line.startsWith('The Shops at Waterloo Town Square, South Lot'))).toHaveLength(1);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('describes where each result’s information comes from', () => {
    const view = buildNearbyView(PARKING_DATASET, KITCHENER_CITY_HALL, MONDAY_AFTERNOON);
    const garage = view.results.find((r) => r.name === 'City Hall Garage');
    expect(garage?.source).toBe('City of Kitchener parking information, checked Sep 2026');
    expect(view.attributions).toHaveLength(2);
  });

  it('reports the local time the statuses are for', () => {
    expect(buildNearbyView(PARKING_DATASET, KITCHENER_CITY_HALL, MONDAY_AFTERNOON).timeLabel).toMatch(/3:42/);
  });

  it('returns empty results away from any city parking', () => {
    const view = buildNearbyView(PARKING_DATASET, { lat: 43.38, lng: -80.6 }, MONDAY_AFTERNOON);
    expect(view.results).toEqual([]);
    expect(view.unverified).toEqual([]);
  });
});
