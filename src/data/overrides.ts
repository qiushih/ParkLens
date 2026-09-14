import type { ParkingOption, ParkingRule, Price, PriceStep, TimeWindow, Weekday } from './types.ts';

export interface Override {
  /** Why the source record can't be used as-is. */
  reason: string;
  /** Where the corrected information comes from, if anywhere beyond the source record. */
  sourceUrl: string | null;
  /** ISO date the override was last checked against its source. */
  checked: string;
  /** Drop the record, with this reason. */
  exclude?: string;
  /** Fields to replace. Supplying `rules` clears the record's parse problems. */
  patch?: Partial<Pick<ParkingOption, 'name' | 'street' | 'kind' | 'spaces' | 'rules' | 'rulesStatus' | 'openHours' | 'notes'>>;
}

// ---------------------------------------------------------------------------------------------
// Rates below were copied from the cities' parking pages. The open data still carries 2018–2021
// rates, so its locations are kept and its rates replaced. Re-check these pages when updating.
// ---------------------------------------------------------------------------------------------

const CHECKED = '2026-09-14';
const KITCHENER_PARKING_PAGE = 'https://www.kitchener.ca/parking/find-a-place-to-park/';
const WATERLOO_PARKING_PAGE = 'https://www.waterloo.ca/parking/find-parking-in-waterloo/';
const WATERLOO_UPTOWN_MAP = 'https://www.waterloo.ca/parking/find-parking-in-waterloo/uptown-waterloo-parking-map/';
const SOME_PERMIT_SPACES = 'Some spaces are permit-only, Monday to Friday, 8 a.m. to 5 p.m.';
/**
 * Waterloo 2-hour lots: free for 2 hours, and longer stays are allowed by paying in HonkMobile.
 * The City doesn't say whether the first 2 hours are then charged, so the charge after 2 hours
 * is recorded as unconfirmed rather than guessed.
 */
const HONK_MOBILE_STEPS: PriceStep[] = [
  { fromMin: 0, toMin: 120, amount: 0, blockMin: 120 },
  { fromMin: 120, toMin: null, amount: null, blockMin: 60 },
];
const HONK_MOBILE_NOTE =
  "Free for 2 hours. To stay longer, pay in the HonkMobile app ($3.50/hour); the City doesn't say whether the first 2 hours are then charged too";

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
const WEEKEND: Weekday[] = [0, 6];
const MON_SAT: Weekday[] = [1, 2, 3, 4, 5, 6];
const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const at = (days: Weekday[], start = '00:00', end = '24:00'): TimeWindow => ({ days, start, end });
const paidPrice = (steps: PriceStep[], dailyMax: number | null): Price => ({ kind: 'paid', steps, dailyMax });
const hourly = (rate: number, dailyMax: number | null = null) =>
  paidPrice([{ fromMin: 0, toMin: null, amount: rate, blockMin: 60 }], dailyMax);
const flat = (amount: number) => paidPrice([{ fromMin: 0, toMin: null, amount, blockMin: 24 * 60 }], amount);
const paid = (when: TimeWindow | null, price: Price, maxStayMin: number | null = null): ParkingRule => ({
  when,
  access: 'public',
  price,
  maxStayMin,
});
const free = (when: TimeWindow | null, maxStayMin: number | null = null): ParkingRule => ({
  when,
  access: 'public',
  price: { kind: 'free' },
  maxStayMin,
});

// --- Kitchener -------------------------------------------------------------------------------

const kitchener = (patch: NonNullable<Override['patch']>): Override => ({
  reason: 'Open data rates are out of date; rates and hours from the City of Kitchener parking page',
  sourceUrl: KITCHENER_PARKING_PAGE,
  checked: CHECKED,
  patch,
});

const OPEN_24H = [at(EVERY_DAY)];
const THEATRE_NOTE = 'Theatre parking $12 on theatre days and nights';

/** "Monday to Friday, 8 a.m. to <end>: $2.80 per hour … Saturday and Sunday: free parking". */
const weekdayLot = (end: string, dailyMax: number | null, maxStayMin: number | null = null): ParkingRule[] => [
  paid(at(WEEKDAYS, '08:00', end), hourly(2.8, dailyMax), maxStayMin),
  free(at(WEEKEND), maxStayMin),
];

/** "less than 2 hours: $4.40; each extra 30 minutes: $1.95". */
const GARAGE_STEPS: PriceStep[] = [
  { fromMin: 0, toMin: 120, amount: 4.4, blockMin: 120 },
  { fromMin: 120, toMin: null, amount: 1.95, blockMin: 30 },
];
/**
 * "Monday to Saturday, 5 p.m. to 5:59 a.m., $6.25 max": starts on Monday–Saturday evenings and
 * runs past midnight, so Saturday night reaches into Sunday morning but Sunday night doesn't.
 */
const GARAGE_EVENING = paid(at(MON_SAT, '17:00', '06:00'), paidPrice(GARAGE_STEPS, 6.25));
const GARAGE_EVENING_NOTE = 'Evening maximum $6.25, Monday to Saturday, 5 p.m. to 5:59 a.m.';
const GARAGE_DAY = paid(null, paidPrice(GARAGE_STEPS, 17.4));

/** Civic District only: "the first and second 30 minutes are $1.30 each"; still $4.40 under 2 hours. */
const CIVIC_DISTRICT: NonNullable<Override['patch']> = {
  rules: [
    free(at([0])),
    paid(
      null,
      paidPrice(
        [
          { fromMin: 0, toMin: 30, amount: 1.3, blockMin: 30 },
          { fromMin: 30, toMin: 60, amount: 1.3, blockMin: 30 },
          { fromMin: 60, toMin: 120, amount: 1.8, blockMin: 60 },
          { fromMin: 120, toMin: null, amount: 1.95, blockMin: 30 },
        ],
        17.4,
      ),
    ),
  ],
  // Sunday parking is listed as free but no Sunday hours are given, so hours stay unstated.
  openHours: null,
  notes: [
    'Theatre parking $10.00',
    'Open Monday to Thursday 6 a.m. to 9 p.m., Friday and Saturday 6 a.m. to 6 p.m.; Sunday parking is listed as free, with no Sunday hours',
    'Outside open hours, only monthly permit holders can enter',
  ],
};

/** Open data lists these downtown segments as metered with no rate. */
const KITCHENER_METERED_STREET_IDS = [
  1925, 1927, 1932, 1934, 1936, 1942, 1947, 1950, 1951, 1953, 1954, 1958, 1960, 1961, 1967, 1974, 1975, 2101,
  2110, 2125, 2127, 2130, 2131, 2132, 2133, 2134, 2135, 2136, 2146, 2147, 2148, 2150, 5925, 5927, 6241, 8159,
  8164, 8165, 8177, 10412, 10413, 10414, 10415, 10416, 10492,
];

// --- Waterloo --------------------------------------------------------------------------------

const waterloo = (patch: NonNullable<Override['patch']>): Override => ({
  reason: 'Open data was last edited in 2018; rules from the City of Waterloo parking page',
  sourceUrl: WATERLOO_PARKING_PAGE,
  checked: CHECKED,
  patch,
});

/**
 * Manual corrections, keyed by ParkingOption id. Every entry must match a source record,
 * or the build fails, so stale overrides can't linger unnoticed.
 */
export const OVERRIDES: Readonly<Record<string, Override>> = {
  // Surface lots
  'kitchener-lot-2013': kitchener({ name: 'Water Street South (Lot 3)', rules: weekdayLot('17:00', 13.95), openHours: OPEN_24H }),
  'kitchener-lot-2090': kitchener({ name: 'Queen Street South (Lot 7)', rules: weekdayLot('17:00', null, 120), openHours: OPEN_24H }),
  'kitchener-lot-2049': kitchener({
    name: 'Ontario Street South (Lot 9)',
    rules: weekdayLot('17:00', null, 120),
    openHours: null,
    notes: ['The City lists weekend parking as free, but opening hours as Monday to Friday, 8 a.m. to 5 p.m.'],
  }),
  'kitchener-lot-2152': kitchener({
    name: 'Green Street (Lot 12)',
    rules: [paid(at(EVERY_DAY, '08:00', '24:00'), hourly(3.2, 16))],
    openHours: OPEN_24H,
  }),
  'kitchener-lot-1945': kitchener({ name: 'Otto Street (Lot 14)', rules: weekdayLot('18:00', 13.95), openHours: OPEN_24H, notes: [THEATRE_NOTE] }),
  'kitchener-lot-4769': kitchener({ name: 'Charles Street West (Lot 15)', rules: weekdayLot('17:00', 13.95), openHours: OPEN_24H }),
  'kitchener-lot-2011': kitchener({ name: "Halls' Lane (Lot 16)", rules: weekdayLot('17:00', null, 120), openHours: OPEN_24H }),
  'kitchener-lot-5952': kitchener({
    name: 'Centre in the Square, Otto Street (Lot 19A)',
    rules: weekdayLot('18:00', 13.95),
    openHours: OPEN_24H,
    notes: [THEATRE_NOTE],
  }),
  'kitchener-lot-7272': kitchener({
    name: 'Centre in the Square, Queen Street North (Lot 19B)',
    rules: weekdayLot('18:00', 13.95),
    openHours: OPEN_24H,
    notes: [THEATRE_NOTE],
  }),
  'kitchener-lot-2064': kitchener({ name: 'Transit (Lot 22)', rules: weekdayLot('17:00', 13.95), openHours: OPEN_24H }),
  'kitchener-lot-5823': kitchener({ name: 'Bramm Street Yards (Lot 24)', rules: weekdayLot('17:00', 13.95), openHours: OPEN_24H }),
  'kitchener-lot-24872': kitchener({
    name: 'Eby Street (Lot 25)',
    rules: [
      paid(
        at(WEEKDAYS, '08:00', '17:00'),
        paidPrice([{ fromMin: 0, toMin: 60, amount: 0, blockMin: 60 }, { fromMin: 60, toMin: null, amount: 2.8, blockMin: 60 }], 13.95),
      ),
    ],
    openHours: [at(WEEKDAYS, '08:00', '17:00')],
    notes: [
      'First hour free once per day, at the payment machine only',
      'No parking Saturday, 12:30 a.m. to 5 p.m., during Kitchener Market activities',
    ],
  }),

  // Garages
  'kitchener-lot-3130': kitchener({
    name: 'Charles & Benton Garage',
    rules: [GARAGE_EVENING, free(at([0])), GARAGE_DAY],
    // The City lists hours as Monday to Saturday yet Sunday parking as free, so hours stay unstated.
    openHours: null,
    notes: [GARAGE_EVENING_NOTE, 'The City lists hours as Monday to Saturday, 24 hours a day, and Sunday parking as free'],
  }),
  'kitchener-lot-1989': kitchener({
    name: 'City Hall Garage',
    rules: [GARAGE_EVENING, GARAGE_DAY],
    openHours: [at(WEEKDAYS, '06:30', '22:00'), at(WEEKEND, '07:00', '22:00')],
    notes: [GARAGE_EVENING_NOTE, 'Outside open hours, entry is by registered licence plate or the help button'],
  }),
  'kitchener-lot-5903': kitchener(CIVIC_DISTRICT),
  'kitchener-lot-5904': kitchener(CIVIC_DISTRICT),
  'kitchener-lot-2085': kitchener({
    name: 'Kitchener Market Garage',
    rules: [GARAGE_DAY],
    openHours: [at(WEEKDAYS, '07:00', '19:00'), at([6], '06:00', '15:00')],
    notes: ['Outside open hours, only monthly permit holders can enter'],
  }),
  'kitchener-lot-2023': kitchener({
    name: 'Duke & Ontario Garage',
    rules: [GARAGE_EVENING, free(at([0])), GARAGE_DAY],
    // The City lists hours as Monday to Saturday yet Sunday parking as free, so hours stay unstated.
    openHours: null,
    notes: [GARAGE_EVENING_NOTE, 'The City lists hours as Monday to Saturday, 24 hours a day, and Sunday parking as free'],
  }),

  // Street parking
  ...Object.fromEntries(
    KITCHENER_METERED_STREET_IDS.map((id): [string, Override] => [
      `kitchener-street-${String(id)}`,
      {
        reason:
          'Open data lists these segments as metered with no rate. The City lists 300+ free two-hour downtown street spaces but does not identify streets, so current rules are unverified',
        sourceUrl: KITCHENER_PARKING_PAGE,
        checked: CHECKED,
        patch: {
          rules: [{ when: null, access: 'public', price: { kind: 'unknown' }, maxStayMin: null }],
          rulesStatus: 'unverified',
          notes: [
            "The City lists more than 300 free, two-hour street parking spaces downtown but doesn't say which streets. Rules for this segment are unverified; check posted signs.",
          ],
        },
      },
    ]),
  ),
  'kitchener-street-6240': {
    reason: 'Street name typo in source ("KNIG ST E")',
    sourceUrl: null,
    checked: CHECKED,
    patch: { name: 'King St E', street: 'King St E' },
  },

  // Waterloo: Uptown Parkade (rates table on the parking page)
  'waterloo-lot-12': waterloo({
    rules: [
      paid(at(WEEKDAYS, '08:00', '21:00'), hourly(4, 20.5)),
      paid(at(WEEKDAYS, '21:00', '24:00'), flat(4)),
      paid(at(WEEKDAYS, '00:00', '08:00'), flat(4)),
      paid(at(WEEKEND), flat(4)),
    ],
    notes: ['Accessible parking permits do not give free parking at the Parkade'],
  }),

  // Waterloo: "2hr FREE PARKING Mon-Fri 8am-5pm" lots on the uptown map
  'waterloo-lot-4': uptownMap(twoHoursFree('The Shops at Waterloo Town Square, North Lot')),
  'waterloo-lot-15': uptownMap(twoHoursFree('The Shops at Waterloo Town Square, South Lot')),
  'waterloo-lot-29': uptownMap(twoHoursFree('The Shops at Waterloo Town Square, South Lot')),
  'waterloo-lot-11': uptownMap(twoHoursFree('City Centre Lot')),
  'waterloo-lot-18': uptownMap(twoHoursFree('Erb Lot')),
  'waterloo-lot-19': uptownMap(twoHoursFree('Erb Lot')),
  'waterloo-lot-16': uptownMap(twoHoursFree('Station Lot')),
  'waterloo-lot-27': uptownMap(twoHoursFree('Station Lot')),
  'waterloo-lot-21': uptownMap(twoHoursFree('Perimeter Lot')),
  'waterloo-lot-30': uptownMap(twoHoursFree('Temporary Lot B', [SOME_PERMIT_SPACES])),

  // Waterloo: "Permit Parking Mon-Fri 8am-5pm" lots on the uptown map
  'waterloo-lot-2': uptownMap(permitLot('Caroline North Lot', ['24-hour and overnight permits available'])),
  'waterloo-lot-3': uptownMap(permitLot('Perimeter Lot')),
  'waterloo-lot-5': uptownMap(permitLot('Bauer Lot')),
  'waterloo-lot-6': uptownMap(permitLot('Alexandra Lot')),
  'waterloo-lot-7': uptownMap(permitLot('Herbert Lot')),
  'waterloo-lot-8': uptownMap(permitLot('Dupont Lot')),
  'waterloo-lot-13': uptownMap(permitLot('Regina Lot')),
  'waterloo-lot-14': uptownMap(permitLot('Caroline South Lot')),
  'waterloo-lot-17': uptownMap(permitLot('William Lot')),
  'waterloo-lot-24': uptownMap(permitLot('The Shops at Waterloo Town Square, South Lot')),
  'waterloo-lot-28': uptownMap(permitLot('Willow Lot')),
  // Pay and Display Mon-Fri 9am-5pm; surface-lot rate from the parking page.
  'waterloo-lot-9': uptownMap({
    name: 'Library Lot',
    rules: [paid(at(WEEKDAYS, '09:00', '17:00'), hourly(3.5)), permit(at(WEEKDAYS, '08:00', '17:00')), ...uptownFreeEvenings()],
    notes: [SOME_PERMIT_SPACES, ...uptownNotes()],
  }),
  'waterloo-lot-10': uptownMap({
    name: 'Dupont Lot',
    rules: [paid(at(WEEKDAYS, '09:00', '17:00'), hourly(3.5)), ...uptownFreeEvenings()],
    notes: uptownNotes(),
  }),

  // Waterloo: records the current map doesn't show
  'waterloo-lot-23': notOnUptownMap('Station Lot has no permit section on the current uptown parking map'),
  'waterloo-lot-26': notOnUptownMap('Station Lot has no permit section on the current uptown parking map'),
  'waterloo-lot-25': notOnUptownMap('Clay & Glass Gallery lot is not on the current uptown parking map'),
};

// Function declarations (hoisted) so the map above can use them.

function uptownMap(patch: NonNullable<Override['patch']>): Override {
  return {
    reason: 'Open data was last edited in 2018; rules from the City of Waterloo uptown parking map',
    sourceUrl: WATERLOO_UPTOWN_MAP,
    checked: CHECKED,
    patch,
  };
}

function notOnUptownMap(exclude: string): Override {
  return { reason: 'Not shown on the current uptown parking map', sourceUrl: WATERLOO_UPTOWN_MAP, checked: CHECKED, exclude };
}

function permit(when: TimeWindow): ParkingRule {
  return { when, access: 'permit', price: null, maxStayMin: null };
}

/**
 * "FREE evenings and weekends until 3am", as windows running past midnight: weekday evenings end
 * at 3 a.m. the next day, and so do Saturday and Sunday. 3–6 a.m. needs overnight registration,
 * so it's left uncovered.
 */
function uptownFreeEvenings(): ParkingRule[] {
  return [free(at(WEEKDAYS, '17:00', '03:00')), free(at(WEEKEND, '06:00', '03:00'))];
}

function uptownNotes(): string[] {
  return [
    'Register for overnight parking to park between 3 a.m. and 6 a.m.',
    'Accessible parking permit holders park free with no time limit',
  ];
}

function twoHoursFree(name: string, extraNotes: string[] = []): NonNullable<Override['patch']> {
  return {
    name,
    rules: [paid(at(WEEKDAYS, '08:00', '17:00'), paidPrice(HONK_MOBILE_STEPS, null)), ...uptownFreeEvenings()],
    notes: [...extraNotes, HONK_MOBILE_NOTE, ...uptownNotes()],
  };
}

function permitLot(name: string, extraNotes: string[] = []): NonNullable<Override['patch']> {
  return {
    name,
    rules: [permit(at(WEEKDAYS, '08:00', '17:00')), ...uptownFreeEvenings()],
    notes: [...extraNotes, ...uptownNotes()],
  };
}
