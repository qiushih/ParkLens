import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { DATASET_FILE, loadRawLayers } from '../../scripts/raw-layers.ts';
import { isInServiceArea } from '../shared/service-area.ts';
import { buildDataset, serializeDataset, type DatasetBuild } from './dataset.ts';
import { centroid } from './geometry.ts';

let build: DatasetBuild;

beforeAll(async () => {
  build = buildDataset(await loadRawLayers());
});

describe('bundled parking dataset', () => {
  it('builds from the raw snapshot without errors', () => {
    expect(build.errors).toEqual([]);
  });

  it('matches the committed parking.kw.json (run `npm run data:build` after changing parsers or overrides)', async () => {
    expect(await readFile(DATASET_FILE, 'utf8')).toBe(serializeDataset(build.dataset));
  });

  it('places every option inside the service area', () => {
    const outside = build.dataset.options.filter((o) => !isInServiceArea({ lng: o.position[0], lat: o.position[1] }));
    expect(outside.map((o) => o.id)).toEqual([]);
  });

  it('puts every centroid inside its source polygon bounds', async () => {
    const layers = await loadRawLayers();
    const features = [...layers.kitchenerStreet.features, ...layers.kitchenerLots.features, ...layers.waterlooLots.features];
    const outside = features.flatMap((feature) => {
      if (!feature.geometry) return [];
      const points = (feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates)
        .flatMap((polygon) => polygon[0] ?? []);
      const lngs = points.map((p) => p[0] ?? NaN);
      const lats = points.map((p) => p[1] ?? NaN);
      const [lng, lat] = centroid(feature.geometry);
      const epsilon = 1e-6;
      const inside =
        lng >= Math.min(...lngs) - epsilon && lng <= Math.max(...lngs) + epsilon &&
        lat >= Math.min(...lats) - epsilon && lat <= Math.max(...lats) + epsilon;
      return inside ? [] : [JSON.stringify(feature.properties).slice(0, 80)];
    });
    expect(outside).toEqual([]);
  });

  it('keeps unverified options without confirmed pricing, preserving their source text', () => {
    const unverified = build.dataset.options.filter((o) => o.rulesStatus === 'unverified');
    expect(unverified).toHaveLength(45);
    for (const option of unverified) {
      expect(option.rules.map((rule) => rule.price?.kind)).toEqual(['unknown']);
      expect(option.source.rawText).toContain('METERED');
    }
  });

  it('keeps privately run parking out', () => {
    const reasons = build.excluded.map((e) => e.reason);
    expect(reasons).toContain('Owner is Private');
    expect(reasons).toContain('Not city-run (division NON-CITY)');
  });

  it('attributes every source', () => {
    for (const source of build.dataset.sources) {
      expect(source.license).not.toBe('');
      expect(source.pageUrl).toMatch(/^https:\/\//);
    }
  });
});
