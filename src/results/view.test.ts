import { describe, expect, it } from 'vitest';
import { PARKING_DATASET } from '../data/bundled';
import { minutesOf } from '../data/schedule';
import type { Weekday } from '../data/types';
import type { StayRequest } from './stay';
import { buildNearbyView } from './view';

const [MON, SAT] = [1, 6] as const;
const KITCHENER_CITY_HALL = { lat: 43.4517589, lng: -80.4924168 };
const WATERLOO_PUBLIC_SQUARE = { lat: 43.4647, lng: -80.5226 };
const FIT_ORDER = ['fits', 'partial', 'unknown', 'restricted', 'not-allowed'];

const stay = (day: Weekday, time: string, durationMin: number): StayRequest => ({ day, minute: minutesOf(time), durationMin });
const view = (destination: { lat: number; lng: number }, request: StayRequest) =>
  buildNearbyView(PARKING_DATASET, destination, request, 'test stay');

/** A dataset holding just one bundled option, with that option's position, so ranking can't hide it. */
function onlyOption(id: string) {
  const option = PARKING_DATASET.options.find((o) => o.id === id);
  if (!option) throw new Error(`No option ${id} in the bundled dataset`);
  const [lng, lat] = option.position;
  return { dataset: { sources: PARKING_DATASET.sources, options: [option] }, position: { lat, lng } };
}

describe('buildNearbyView (bundled dataset)', () => {
  it('ranks by fit for the stay, within walking range', () => {
    const { results, maxWalkMin } = view(KITCHENER_CITY_HALL, stay(MON, '15:42', 180));

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
    expect(results.every((r) => r.walkMin <= maxWalkMin)).toBe(true);
    const ranks = results.map((r) => FIT_ORDER.indexOf(r.fit));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('puts options that fit a 3-hour stay ahead of 2-hour street parking', () => {
    const { results } = view(KITCHENER_CITY_HALL, stay(MON, '10:00', 180));
    expect(results[0]?.fit).toBe('fits');
    const firstPartial = results.findIndex((r) => r.fit === 'partial');
    const lastFit = results.map((r) => r.fit).lastIndexOf('fits');
    if (firstPartial !== -1) expect(lastFit).toBeLessThan(firstPartial);
  });

  it('ranks a partial fit lower the less of the stay it covers', () => {
    // Street parking only, so every result near City Hall is a partial fit for 3 hours.
    const streets = { sources: PARKING_DATASET.sources, options: PARKING_DATASET.options.filter((o) => o.kind === 'street') };
    const { results } = buildNearbyView(streets, KITCHENER_CITY_HALL, stay(MON, '10:00', 180), 'test stay');

    const shortLimit = results.findIndex((r) => r.name === 'College St' && r.headline.startsWith('30 min max'));
    const nearbyTwoHour = results.filter((r) => r.walkMin <= 3 && r.headline.startsWith('2 hr max'));
    expect(shortLimit).toBeGreaterThan(-1);
    expect(nearbyTwoHour.length).toBeGreaterThan(0);
    for (const item of nearbyTwoHour) expect(results.indexOf(item)).toBeLessThan(shortLimit);
  });

  it('prefers free over paid at a similar walk', () => {
    const { results } = view(WATERLOO_PUBLIC_SQUARE, stay(MON, '10:00', 120));
    const fitting = results.filter((r) => r.fit === 'fits');
    expect(fitting[0]?.headline).toBe('Free for your whole stay');
  });

  it('never mixes unverified options into the main results', () => {
    const request = stay(MON, '10:00', 60);
    const { results, unverified } = view(KITCHENER_CITY_HALL, request);
    const unverifiedIds = new Set(PARKING_DATASET.options.filter((o) => o.rulesStatus === 'unverified').map((o) => o.id));

    expect(results.some((r) => unverifiedIds.has(r.id))).toBe(false);
    expect(unverified.length).toBeGreaterThan(0);
    for (const item of unverified) {
      expect(unverifiedIds.has(item.id)).toBe(true);
      expect(item.headline).toBe('Rules unverified · check posted signs');
    }
  });

  it('shows free weekend parking in uptown Waterloo on a Saturday', () => {
    const townSquare = view(WATERLOO_PUBLIC_SQUARE, stay(SAT, '12:00', 120)).results.find((r) =>
      r.name.startsWith('The Shops at Waterloo Town Square'),
    );
    expect(townSquare).toMatchObject({ fit: 'fits', headline: 'Free for your whole stay' });
  });

  it('shows a lot once when its sections read the same for the stay', () => {
    // Monday 6 p.m.: Town Square South's 2-hour and permit sections are both free.
    const lines = view(WATERLOO_PUBLIC_SQUARE, stay(MON, '18:00', 120)).results.map((r) => `${r.name} | ${r.headline} | ${r.atArrival}`);
    expect(lines.filter((line) => line.startsWith('The Shops at Waterloo Town Square, South Lot'))).toHaveLength(1);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('adds a timeline when the rules change during the stay', () => {
    const { dataset, position } = onlyOption('kitchener-lot-3130');
    const [garage] = buildNearbyView(dataset, position, stay(MON, '16:00', 120), 'test stay').results;
    expect(garage?.timeline).toEqual([
      '4:00 p.m. to 5:00 p.m.: $4.40 for the first 2 hr, then $1.95 per 30 min · $17.40 max',
      '5:00 p.m. to 6:00 p.m.: $4.40 for the first 2 hr, then $1.95 per 30 min · $6.25 max',
    ]);
  });

  it('describes where each result’s information comes from', () => {
    const { dataset, position } = onlyOption('kitchener-lot-1989');
    const [garage] = buildNearbyView(dataset, position, stay(MON, '10:00', 60), 'test stay').results;
    expect(garage?.source).toBe('City of Kitchener parking information, checked Sep 2026');
    expect(view(KITCHENER_CITY_HALL, stay(MON, '10:00', 60)).attributions).toHaveLength(2);
  });

  it('reports when rates and rules were last checked', () => {
    expect(view(KITCHENER_CITY_HALL, stay(MON, '10:00', 60)).dataChecked).toBe('Sep 2026');
  });

  it('returns empty results away from any city parking, still with both cities’ street rules', () => {
    const result = view({ lat: 43.38, lng: -80.6 }, stay(MON, '10:00', 60));
    expect(result.results).toEqual([]);
    expect(result.unverified).toEqual([]);
    expect(result.streetRules.map((note) => note.city)).toEqual(['Kitchener', 'Waterloo']);
  });

  it('adds the street rules for the city the nearby parking is in, separate from the results', () => {
    const kitchener = view(KITCHENER_CITY_HALL, stay(MON, '10:00', 60));
    const waterloo = view(WATERLOO_PUBLIC_SQUARE, stay(MON, '10:00', 60));
    expect(kitchener.streetRules.map((note) => note.city)).toEqual(['Kitchener']);
    expect(waterloo.streetRules.map((note) => note.city)).toEqual(['Waterloo']);

    const optionIds = new Set(PARKING_DATASET.options.map((o) => o.id));
    expect([...kitchener.results, ...kitchener.unverified].every((item) => optionIds.has(item.id))).toBe(true);
  });
});
