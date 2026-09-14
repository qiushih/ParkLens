/**
 * Coarse bounding box around the cities of Kitchener and Waterloo, ON.
 * Deliberately a little generous: a place just outside city limits will simply have
 * no nearby city parking once parking data is added.
 */
export const SERVICE_AREA = {
  label: 'Kitchener and Waterloo, ON',
  south: 43.36,
  north: 43.54,
  west: -80.63,
  east: -80.37,
} as const;

export function isInServiceArea({ lat, lng }: { lat: number; lng: number }): boolean {
  return (
    lat >= SERVICE_AREA.south &&
    lat <= SERVICE_AREA.north &&
    lng >= SERVICE_AREA.west &&
    lng <= SERVICE_AREA.east
  );
}
