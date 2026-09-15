import type { ParkingDataset, ParkingOption } from '../data/types';
import { formatMonthYear } from './format';
import { findNearby, MAX_WALK_MINUTES } from './nearby';
import { streetRulesFor, type StreetRulesNote } from './street-rules';
import { clockAfter, describeStay, evaluateStay, type Fit, type StayEvaluation, type StayRequest } from './stay';
import { statusAt, UNVERIFIED_SUMMARY } from './status';

const MAX_RESULTS = 8;
const MAX_UNVERIFIED = 5;

/** Within a fit group, each dollar ranks like two more minutes of walking. */
const WALK_MINUTES_PER_DOLLAR = 2;
/** An unconfirmed cost ranks like a six-minute-longer walk. */
const UNKNOWN_COST_PENALTY_MIN = 6;
/** A partial fit ranks lower the less of the stay it covers, by up to ten minutes of walking. */
const UNCOVERED_STAY_PENALTY_MIN = 10;

const FIT_ORDER: Readonly<Record<Fit, number>> = {
  fits: 0,
  partial: 1,
  unknown: 2,
  restricted: 3,
  'not-allowed': 4,
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
  fit: Fit;
  /** How the option works for the stay, e.g. "$8.40 for your stay". */
  headline: string;
  /** The rule in effect on arrival, e.g. "$2.80/hr · $13.95 max". */
  atArrival: string;
  /** One line per stretch of the stay, when the rules change during it. */
  timeline: string[];
  notes: string[];
  source: string;
  /** Lower ranks higher within a fit group. */
  score: number;
}

/** Everything the panel shows for a destination; plain data so it can be compared between refreshes. */
export interface NearbyView {
  stayLabel: string;
  maxWalkMin: number;
  /** Options with stated rules: best fit first, then by walk and cost. */
  results: ResultItem[];
  /** Options whose rules are unverified, kept apart so they never read as confirmed parking. */
  unverified: ResultItem[];
  /** General street parking rules for the nearby cities: an informational note, never a result. */
  streetRules: StreetRulesNote[];
  /** When rates and rules were last checked against city websites (the oldest check), e.g. "Sep 2026". */
  dataChecked: string | null;
  attributions: string[];
}

export function buildNearbyView(
  dataset: ParkingDataset,
  destination: { lat: number; lng: number },
  stay: StayRequest,
  stayLabel: string,
): NearbyView {
  const nearby = findNearby(dataset, destination);

  // findNearby sorts by distance and Array#sort is stable, so ties keep nearest-first order.
  const results = withoutLookalikes(
    nearby
      .filter(({ option }) => option.rulesStatus === 'stated')
      .map(({ option, walkMin }) => toItem(option, walkMin, stay))
      .sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || a.score - b.score),
  ).slice(0, MAX_RESULTS);

  const unverified = withoutLookalikes(
    nearby.filter(({ option }) => option.rulesStatus === 'unverified').map(({ option, walkMin }) => toItem(option, walkMin, stay)),
  ).slice(0, MAX_UNVERIFIED);

  const streetRules = streetRulesFor(new Set(nearby.map(({ option }) => option.city)));

  return {
    stayLabel,
    maxWalkMin: MAX_WALK_MINUTES,
    results,
    unverified,
    streetRules,
    dataChecked: oldestCheck(dataset, streetRules),
    attributions: [...new Set(dataset.sources.map((source) => source.attribution))],
  };
}

/**
 * Records with different rules can read identically for a stay, e.g. a lot's permit and 2-hour
 * sections are both free in the evening. Keep the first (best-ranked) of each lookalike.
 */
function withoutLookalikes(items: ResultItem[]): ResultItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}\n${item.headline}\n${item.atArrival}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toItem(option: ParkingOption, walkMin: number, stay: StayRequest): ResultItem {
  const evaluation = evaluateStay(option, stay);
  return {
    id: option.id,
    name: option.name,
    kindLabel: KIND_LABELS[option.kind],
    walkMin,
    fit: evaluation.fit,
    headline: option.rulesStatus === 'unverified' ? UNVERIFIED_SUMMARY : describeStay(evaluation, stay),
    atArrival: statusAt(option, stay.day, stay.minute).summary,
    timeline:
      evaluation.segments.length > 1
        ? evaluation.segments.map((s) => `${clockAfter(stay, s.fromMin)} to ${clockAfter(stay, s.toMin)}: ${s.summary}`)
        : [],
    notes: option.notes,
    source: describeSource(option),
    score: walkMin + costPenalty(evaluation) + coveragePenalty(evaluation, stay),
  };
}

function coveragePenalty({ allowedMin }: StayEvaluation, stay: StayRequest): number {
  return allowedMin === null ? 0 : (1 - allowedMin / stay.durationMin) * UNCOVERED_STAY_PENALTY_MIN;
}

function costPenalty({ cost }: StayEvaluation): number {
  switch (cost.kind) {
    case 'free':
      return 0;
    case 'exact':
    case 'estimate':
      return cost.amount * WALK_MINUTES_PER_DOLLAR;
    case 'unknown':
      return UNKNOWN_COST_PENALTY_MIN;
  }
}

/** The oldest date any rate or rule was checked against a city website, so the footer never overstates freshness. */
function oldestCheck(dataset: ParkingDataset, streetRules: readonly StreetRulesNote[]): string | null {
  const checked = [
    ...dataset.options.flatMap((option) => (option.override?.sourceUrl ? [option.override.checked] : [])),
    ...streetRules.map((note) => note.checked),
  ].sort();
  return checked[0] ? formatMonthYear(checked[0]) : null;
}

function describeSource(option: ParkingOption): string {
  const publisher = `City of ${option.city}`;
  if (option.override?.sourceUrl) {
    return `${publisher} parking information, checked ${formatMonthYear(option.override.checked)}`;
  }
  const updated = option.source.updated ? formatMonthYear(option.source.updated) : 'date unknown';
  return `${publisher} open data, last updated ${updated}`;
}

