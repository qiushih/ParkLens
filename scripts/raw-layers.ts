import { readFile } from 'node:fs/promises';
import type { RawLayers } from '../src/data/dataset.ts';
import type { KitchenerLotProps, KitchenerStreetProps } from '../src/data/kitchener.ts';
import type { DatasetId, RawLayer } from '../src/data/types.ts';
import type { WaterlooLotProps } from '../src/data/waterloo.ts';

/** Downloaded source snapshots, committed so builds and tests are offline and reviewable. */
export const RAW_DIR = new URL('../data/raw/', import.meta.url);
/** The normalized dataset bundled into the extension. */
export const DATASET_FILE = new URL('../src/data/parking.kw.json', import.meta.url);
/** Human-readable summary of the last build: exclusions, overrides, record ages. */
export const REPORT_FILE = new URL('../data/REPORT.md', import.meta.url);

async function readLayer(dataset: DatasetId): Promise<unknown> {
  return JSON.parse(await readFile(new URL(`${dataset}.json`, RAW_DIR), 'utf8'));
}

export async function loadRawLayers(): Promise<RawLayers> {
  const [kitchenerStreet, kitchenerLots, waterlooLots] = await Promise.all([
    readLayer('kitchener-on-street'),
    readLayer('kitchener-public-lots'),
    readLayer('waterloo-city-lots'),
  ]);
  return {
    kitchenerStreet: kitchenerStreet as RawLayer<KitchenerStreetProps>,
    kitchenerLots: kitchenerLots as RawLayer<KitchenerLotProps>,
    waterlooLots: waterlooLots as RawLayer<WaterlooLotProps>,
  };
}
