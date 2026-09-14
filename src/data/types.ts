/** 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeWindow {
  days: Weekday[];
  /** "HH:MM", 24-hour. */
  start: string;
  /**
   * "HH:MM", 24-hour, exclusive. "24:00" is midnight at the end of the day. An end earlier than
   * `start` means the window runs past midnight: it starts on each of `days` and ends the next day.
   */
  end: string;
}

/** Charge `amount` for each started `blockMin` minutes of the stay between `fromMin` and `toMin`. */
export interface PriceStep {
  fromMin: number;
  toMin: number | null;
  /** Null when this part of the stay is charged but the amount isn't confirmed. */
  amount: number | null;
  blockMin: number;
}

export type Price =
  | { kind: 'free' }
  /** Neither whether it's free nor what it costs is confirmed. */
  | { kind: 'unknown' }
  | { kind: 'paid'; steps: PriceStep[]; dailyMax: number | null }
  /** Paid, but the source doesn't list the rate (e.g. metered street parking). */
  | { kind: 'paid-rate-unknown' };

export type Access = 'public' | 'permit' | 'facility-visitors';

export interface ParkingRule {
  /** When the rule applies; null when the source doesn't say. */
  when: TimeWindow | null;
  access: Access;
  /** Null for permit parking, where the permit fee isn't relevant to a visitor. */
  price: Price | null;
  maxStayMin: number | null;
}

export type City = 'Kitchener' | 'Waterloo';

export type DatasetId = 'kitchener-on-street' | 'kitchener-public-lots' | 'waterloo-city-lots';

export interface ParkingOption {
  /** Stable across rebuilds: derived from the source's own facility id where it has one. */
  id: string;
  city: City;
  kind: 'street' | 'lot' | 'garage';
  name: string;
  /** Title-cased street, e.g. "King St W". */
  street: string | null;
  /** Centroid of the source polygon. */
  position: [lng: number, lat: number];
  spaces: number | null;
  accessibleSpaces: number | null;
  /**
   * Rules in precedence order: for a given time, the first rule whose `when` matches applies
   * (`when: null` matches any time). Times no rule covers are unknown, not free.
   */
  rules: ParkingRule[];
  /**
   * `stated`: the rules come from an official source describing this record.
   * `unverified`: current rules aren't confirmed; never rank or present the option as confirmed
   * free or paid parking.
   */
  rulesStatus: 'stated' | 'unverified';
  /** When the facility is open, if stated; null means not stated (not "always open"). */
  openHours: TimeWindow[] | null;
  notes: string[];
  source: {
    dataset: DatasetId;
    objectId: number;
    /** ISO date the record was last edited, or the dataset's when records carry no date. */
    updated: string | null;
    /** Original cost/hours text, for review and for showing on expand. */
    rawText: string;
  };
  /** Set when a manual override in overrides.ts changed this record. */
  override: { reason: string; sourceUrl: string | null; checked: string } | null;
}

export interface DatasetSource {
  dataset: DatasetId;
  name: string;
  publisher: string;
  pageUrl: string;
  license: string;
  licenseUrl: string;
  /** The wording the licence asks for when crediting the publisher. */
  attribution: string;
  lastEdited: string | null;
}

/** The bundled file the extension reads (src/data/parking.kw.json). */
export interface ParkingDataset {
  sources: DatasetSource[];
  options: ParkingOption[];
}

type Position = number[];

export type PolygonGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

export interface SourceFeature<P> {
  properties: P;
  geometry: PolygonGeometry | null;
}

/** One downloaded layer, as stored in data/raw/<dataset>.json. */
export interface RawLayer<P> {
  dataset: DatasetId;
  url: string;
  lastEdited: string | null;
  features: SourceFeature<P>[];
}

export interface Excluded {
  kind: 'excluded';
  id: string;
  name: string;
  reason: string;
}

export type NormalizeOutcome =
  | { kind: 'option'; option: ParkingOption; problems: string[] }
  | Excluded;
