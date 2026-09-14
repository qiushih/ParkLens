import { normalizeKitchenerLot, normalizeKitchenerStreet, type KitchenerLotProps, type KitchenerStreetProps } from './kitchener.ts';
import { OVERRIDES, type Override } from './overrides.ts';
import { DATASETS } from './sources.ts';
import type { Excluded, ParkingDataset, ParkingOption, RawLayer } from './types.ts';
import { normalizeWaterlooLot, type WaterlooLotProps } from './waterloo.ts';

export interface RawLayers {
  kitchenerStreet: RawLayer<KitchenerStreetProps>;
  kitchenerLots: RawLayer<KitchenerLotProps>;
  waterlooLots: RawLayer<WaterlooLotProps>;
}

export interface DatasetBuild {
  dataset: ParkingDataset;
  excluded: Excluded[];
  /** Ids of options changed or excluded by an override. */
  overridden: string[];
  /** Anything that must be fixed (in a parser or overrides.ts) before the output is written. */
  errors: string[];
}

/** Exact file contents of parking.kw.json, shared by the build script and the drift test. */
export function serializeDataset(dataset: ParkingDataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}

export function buildDataset(
  layers: RawLayers,
  overrides: Readonly<Record<string, Override>> = OVERRIDES,
): DatasetBuild {
  const outcomes = [
    ...layers.kitchenerStreet.features.map((f) => normalizeKitchenerStreet(f)),
    ...layers.kitchenerLots.features.map((f) => normalizeKitchenerLot(f)),
    ...layers.waterlooLots.features.map((f) => normalizeWaterlooLot(f, layers.waterlooLots.lastEdited)),
  ];

  const options: ParkingOption[] = [];
  const excluded: Excluded[] = [];
  const overridden: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const outcome of outcomes) {
    const id = outcome.kind === 'option' ? outcome.option.id : outcome.id;
    if (seen.has(id)) errors.push(`Duplicate id ${id}`);
    seen.add(id);

    const override = overrides[id];
    if (override) overridden.push(id);

    if (outcome.kind === 'excluded') {
      if (override?.patch) errors.push(`${id}: override patches a record that is excluded (${outcome.reason})`);
      excluded.push(outcome);
      continue;
    }
    if (override?.exclude) {
      excluded.push({ kind: 'excluded', id, name: outcome.option.name, reason: override.exclude });
      continue;
    }

    const option: ParkingOption = override?.patch
      ? {
          ...outcome.option,
          ...override.patch,
          override: { reason: override.reason, sourceUrl: override.sourceUrl, checked: override.checked },
        }
      : outcome.option;
    const problems = override?.patch?.rules ? [] : outcome.problems;
    errors.push(...problems.map((problem) => `${id} (${option.name}): ${problem}`));
    if (option.rules.length === 0 && problems.length === 0) errors.push(`${id} (${option.name}): no rules`);
    const windows = [...option.rules.flatMap((rule) => (rule.when ? [rule.when] : [])), ...(option.openHours ?? [])];
    for (const window of windows) {
      if (window.start === window.end || window.days.length === 0) {
        errors.push(`${id} (${option.name}): empty time window ${JSON.stringify(window)}`);
      }
    }
    if (option.rulesStatus === 'unverified' && option.rules.some((rule) => rule.price?.kind === 'free')) {
      errors.push(`${id} (${option.name}): unverified rules must not include free pricing`);
    }
    options.push(option);
  }

  for (const id of Object.keys(overrides)) {
    if (!seen.has(id)) errors.push(`Override for ${id} matches no source record`);
  }

  options.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  excluded.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

  const sources = [layers.kitchenerStreet, layers.kitchenerLots, layers.waterlooLots].map((layer) => {
    const info = DATASETS[layer.dataset];
    return {
      dataset: layer.dataset,
      name: info.name,
      publisher: info.publisher,
      pageUrl: info.pageUrl,
      license: info.license,
      licenseUrl: info.licenseUrl,
      attribution: info.attribution,
      lastEdited: layer.lastEdited,
    };
  });

  return { dataset: { sources, options }, excluded, overridden, errors };
}
