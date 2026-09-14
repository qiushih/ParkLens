import { describe, expect, it } from 'vitest';
import { isInServiceArea } from './service-area';
import { resolveViewState } from './view-state';

describe('resolveViewState', () => {
  it('is no-maps-tab when the URL is hidden or not Google Maps', () => {
    expect(resolveViewState(undefined)).toEqual({ kind: 'no-maps-tab' });
    expect(resolveViewState('https://example.com/')).toEqual({ kind: 'no-maps-tab' });
  });

  it('is no-destination while browsing the map', () => {
    expect(resolveViewState('https://www.google.com/maps/@43.46,-80.52,14z')).toEqual({
      kind: 'no-destination',
    });
  });

  it('is in-area for a Waterloo place', () => {
    const state = resolveViewState('https://www.google.com/maps/place/Uptown+Waterloo/@43.4643,-80.5204,16z');
    expect(state.kind).toBe('in-area');
  });

  it('is outside-area for a Toronto place', () => {
    const state = resolveViewState('https://www.google.com/maps/place/CN+Tower/@43.6426,-79.3871,16z');
    expect(state).toMatchObject({ kind: 'outside-area', destination: { name: 'CN Tower' } });
  });
});

describe('isInServiceArea', () => {
  it.each([
    ['Kitchener City Hall', 43.4516, -80.4925, true],
    ['University of Waterloo', 43.4723, -80.5449, true],
    ['Fairview Park Mall', 43.4242, -80.4388, true],
    ['Guelph', 43.5448, -80.2482, false],
    ['Toronto', 43.6532, -79.3832, false],
    ['Stratford', 43.3700, -80.9822, false],
  ])('%s → %s', (_name, lat, lng, expected) => {
    expect(isInServiceArea({ lat, lng })).toBe(expected);
  });
});
