// Downloads each source layer from its ArcGIS FeatureServer into data/raw/<dataset>.json.
// Usage: npm run data:fetch   (then npm run data:build)
import { mkdir, writeFile } from 'node:fs/promises';
import { DATASETS } from '../src/data/sources.ts';
import { isoDate } from '../src/data/text.ts';
import type { DatasetId } from '../src/data/types.ts';
import { RAW_DIR } from './raw-layers.ts';

interface LayerInfo {
  maxRecordCount?: number;
  editingInfo?: { dataLastEditDate?: number };
}

interface GeoJsonPage {
  features?: { properties: unknown; geometry: { type: string; coordinates: unknown } | null }[];
  exceededTransferLimit?: boolean;
  properties?: { exceededTransferLimit?: boolean };
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${String(response.status)} for ${url}`);
  const body = (await response.json()) as { error?: { message?: string } };
  // ArcGIS reports query errors with HTTP 200.
  if (body.error) throw new Error(`ArcGIS error for ${url}: ${body.error.message ?? 'unknown'}`);
  return body;
}

/** 7 decimals is ~1 cm; trims float noise so re-fetches produce clean diffs. */
function roundCoordinates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(roundCoordinates);
  return typeof value === 'number' ? Math.round(value * 1e7) / 1e7 : value;
}

await mkdir(RAW_DIR, { recursive: true });

for (const dataset of Object.keys(DATASETS) as DatasetId[]) {
  const { serviceUrl } = DATASETS[dataset];
  const info = (await getJson(`${serviceUrl}?f=json`)) as LayerInfo;
  const pageSize = info.maxRecordCount ?? 1000;
  const features: unknown[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      outSR: '4326',
      orderByFields: 'OBJECTID',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      f: 'geojson',
    });
    const page = (await getJson(`${serviceUrl}/query?${query.toString()}`)) as GeoJsonPage;
    for (const { properties, geometry } of page.features ?? []) {
      features.push({
        properties,
        geometry: geometry && { type: geometry.type, coordinates: roundCoordinates(geometry.coordinates) },
      });
    }
    if (!(page.exceededTransferLimit ?? page.properties?.exceededTransferLimit)) break;
  }

  const lastEdited = isoDate(info.editingInfo?.dataLastEditDate);
  // One feature per line keeps diffs between snapshots readable.
  const header = `{"dataset":${JSON.stringify(dataset)},"url":${JSON.stringify(serviceUrl)},"lastEdited":${JSON.stringify(lastEdited)},"features":[`;
  const body = features.map((feature) => JSON.stringify(feature)).join(',\n');
  await writeFile(new URL(`${dataset}.json`, RAW_DIR), `${header}\n${body}\n]}\n`);
  console.log(`${dataset}: ${String(features.length)} features (layer last edited ${lastEdited ?? 'unknown'})`);
}
