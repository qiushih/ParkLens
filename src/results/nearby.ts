import type { ParkingDataset, ParkingOption } from '../data/types';

/** Walking a street grid covers more ground than the straight line between two points. */
const DETOUR_FACTOR = 1.3;
const WALK_METRES_PER_MINUTE = 80;
export const MAX_WALK_MINUTES = 15;

export interface NearbyOption {
  option: ParkingOption;
  distanceM: number;
  /** Approximate: straight-line distance with a detour factor, not a routed walk. */
  walkMin: number;
}

interface Point {
  lat: number;
  lng: number;
}

/** Great-circle distance in metres. */
export function distanceMetres(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
}

export function estimateWalkMinutes(distanceM: number): number {
  return Math.max(1, Math.round((distanceM * DETOUR_FACTOR) / WALK_METRES_PER_MINUTE));
}

/**
 * Options within walking range, nearest first. Records for the same place with the same rules
 * (a lot split into polygons, consecutive segments of a street) collapse to their nearest member.
 */
export function findNearby(dataset: ParkingDataset, destination: Point, maxWalkMin = MAX_WALK_MINUTES): NearbyOption[] {
  const nearestByPlace = new Map<string, NearbyOption>();

  for (const option of dataset.options) {
    const [lng, lat] = option.position;
    const distanceM = distanceMetres(destination, { lat, lng });
    const walkMin = estimateWalkMinutes(distanceM);
    if (walkMin > maxWalkMin) continue;

    const place = JSON.stringify([option.city, option.kind, option.name, option.rulesStatus, option.rules]);
    const current = nearestByPlace.get(place);
    if (!current || distanceM < current.distanceM) nearestByPlace.set(place, { option, distanceM, walkMin });
  }

  return [...nearestByPlace.values()].sort((a, b) => a.distanceM - b.distanceM);
}
