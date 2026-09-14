import type { ParkingDataset, ParkingOption } from '../data/types';
import { localMoment, type LocalMoment } from './clock';
import { findNearby, MAX_WALK_MINUTES } from './nearby';
import { statusAt, type Availability } from './status';

const MAX_RESULTS = 8;
const MAX_UNVERIFIED = 5;

const AVAILABILITY_ORDER: Readonly<Record<Availability, number>> = {
  available: 0,
  unknown: 1,
  restricted: 2,
  closed: 3,
};

const KIND_LABELS: Readonly<Record<ParkingOption['kind'], string>> = {
  street: 'Street parking',
  lot: 'Parking lot',
  garage: 'Parking garage',
};

export interface ResultItem {
  id: string;
  name: string;
  kindLabel: string;
  /** Approximate straight-line estimate. */
  walkMin: number;
  availability: Availability;
  summary: string;
  notes: string[];
  source: string;
}

/** Everything the panel shows for a destination; plain data so it can be compared between refreshes. */
export interface NearbyView {
  timeLabel: string;
  maxWalkMin: number;
  /** Options with stated rules: available now first, then nearest first. */
  results: ResultItem[];
  /** Options whose rules are unverified, kept apart so they never read as confirmed parking. */
  unverified: ResultItem[];
  attributions: string[];
}

export function buildNearbyView(dataset: ParkingDataset, destination: { lat: number; lng: number }, now: Date): NearbyView {
  const moment = localMoment(now);
  const nearby = findNearby(dataset, destination);

  // findNearby sorts by distance and Array#sort is stable, so ties keep nearest-first order.
  const results = withoutLookalikes(
    nearby
      .filter(({ option }) => option.rulesStatus === 'stated')
      .map(({ option, walkMin }) => toItem(option, walkMin, moment))
      .sort((a, b) => AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability]),
  ).slice(0, MAX_RESULTS);

  const unverified = withoutLookalikes(
    nearby.filter(({ option }) => option.rulesStatus === 'unverified').map(({ option, walkMin }) => toItem(option, walkMin, moment)),
  ).slice(0, MAX_UNVERIFIED);

  return {
    timeLabel: moment.label,
    maxWalkMin: MAX_WALK_MINUTES,
    results,
    unverified,
    attributions: [...new Set(dataset.sources.map((source) => source.attribution))],
  };
}

/**
 * Records with different rules can read identically at a given time, e.g. a lot's permit and
 * 2-hour sections are both free in the evening. Keep the first (nearest) of each lookalike.
 */
function withoutLookalikes(items: ResultItem[]): ResultItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}\n${item.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toItem(option: ParkingOption, walkMin: number, moment: LocalMoment): ResultItem {
  const status = statusAt(option, moment.day, moment.minute);
  return {
    id: option.id,
    name: option.name,
    kindLabel: KIND_LABELS[option.kind],
    walkMin,
    availability: status.availability,
    summary: status.summary,
    notes: option.notes,
    source: describeSource(option),
  };
}

function describeSource(option: ParkingOption): string {
  const publisher = `City of ${option.city}`;
  if (option.override?.sourceUrl) {
    return `${publisher} parking information, checked ${monthYear(option.override.checked)}`;
  }
  const updated = option.source.updated ? monthYear(option.source.updated) : 'date unknown';
  return `${publisher} open data, last updated ${updated}`;
}

function monthYear(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
