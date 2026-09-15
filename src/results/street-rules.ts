import type { City } from '../data/types';

/**
 * General street parking rules, shown as an informational note beside the results and never as a
 * parking option. Wording follows each city's parking bylaw pages; re-check them when they change.
 */
export interface StreetRulesNote {
  city: City;
  points: string[];
  sources: { label: string; url: string }[];
  /** ISO date the wording was last checked against the sources. */
  checked: string;
}

export const STREET_RULES_DISCLAIMER =
  "This isn't a parking spot. These general city rules apply unless posted signs say otherwise, so always check the signs where you park.";

export const STREET_RULES: Readonly<Record<City, StreetRulesNote>> = {
  Kitchener: {
    city: 'Kitchener',
    points: [
      'No parking for more than 3 hours in a row on any city street, 6 a.m. to 11 p.m., unless signs say otherwise.',
      'December 1 to March 31: parking overnight (2:30 to 6 a.m.) needs an overnight parking exemption, requested before 2 a.m. No exemption is needed from April 1 to November 30.',
      'No street parking when more than 8 cm of snow is forecast or a snow event is declared. Snow events cancel exemptions.',
      "Downtown free two-hour spaces: you can't park in one again within five hours.",
    ],
    sources: [
      { label: 'City of Kitchener parking bylaws', url: 'https://www.kitchener.ca/bylaws-and-enforcement/parking-bylaws/' },
      { label: 'overnight parking exemptions', url: 'https://www.kitchener.ca/parking/overnight-parking-exemptions/' },
    ],
    checked: '2026-09-14',
  },
  Waterloo: {
    city: 'Waterloo',
    points: [
      'On residential streets, park free for up to 3 hours, unless signs say otherwise.',
      'No overnight parking from 2:30 to 6 a.m., unless you register in advance.',
      "During a snow event, no parking on any city street or lot, even if you're registered.",
    ],
    sources: [{ label: 'City of Waterloo parking rules and bylaws', url: 'https://www.waterloo.ca/parking/parking-rules-and-bylaws/' }],
    checked: '2026-09-14',
  },
};

/**
 * Which cities' rules to show, from the cities of the parking found near the destination. When
 * that's one city, show its rules; when it's both or none (e.g. near the border), show both
 * rather than guess.
 */
export function streetRulesFor(nearbyCities: ReadonlySet<City>): StreetRulesNote[] {
  const [only] = nearbyCities;
  return nearbyCities.size === 1 && only ? [STREET_RULES[only]] : [STREET_RULES.Kitchener, STREET_RULES.Waterloo];
}
