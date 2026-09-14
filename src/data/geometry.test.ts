import { describe, expect, it } from 'vitest';
import { centroid } from './geometry.ts';

describe('centroid', () => {
  it('finds the centre of a polygon', () => {
    const square = [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]];
    expect(centroid({ type: 'Polygon', coordinates: square })).toEqual([1, 1]);
  });

  it('is independent of ring winding', () => {
    const clockwise = [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]];
    expect(centroid({ type: 'Polygon', coordinates: clockwise })).toEqual([1, 1]);
  });

  it('weights multipolygon parts by area', () => {
    const big = [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]; // area 4, centre (1, 1)
    const small = [[[10, 0], [11, 0], [11, 1], [10, 1], [10, 0]]]; // area 1, centre (10.5, 0.5)
    expect(centroid({ type: 'MultiPolygon', coordinates: [big, small] })).toEqual([2.9, 0.9]);
  });

  it('ignores holes', () => {
    const withHole = [
      [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
      [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1], [0.5, 0.5]],
    ];
    expect(centroid({ type: 'Polygon', coordinates: withHole })).toEqual([2, 2]);
  });

  it('falls back to the mean vertex for zero-area shapes', () => {
    const line = [[[0, 0], [3, 0], [0, 0]]];
    expect(centroid({ type: 'Polygon', coordinates: line })).toEqual([1, 0]);
  });

  it('rounds to 6 decimals', () => {
    const tiny = [[[-80.4925337, 43.4516395], [-80.4925, 43.4516395], [-80.4925, 43.4517], [-80.4925337, 43.4517], [-80.4925337, 43.4516395]]];
    const [lng, lat] = centroid({ type: 'Polygon', coordinates: tiny });
    expect(lng).toBeCloseTo(-80.492517, 6);
    expect(lat).toBeCloseTo(43.45167, 6);
  });
});
