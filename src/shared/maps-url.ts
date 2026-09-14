/**
 * Reads the destination out of a Google Maps URL.
 *
 * Only the URL is used, never Google's page content. Two URL shapes carry a destination:
 *
 *   /maps/place/<Name>/@<lat>,<lng>,<zoom>z/data=!4m6!3m5!1s…!8m2!3d<lat>!4d<lng>!16s…
 *   /maps/dir/<Origin>/<Destination>/@…/data=!4m14!4m13!1m5!1m1!1s…!2m2!1d<lng>!2d<lat>!1m5…
 *
 * The `data=` segment is a flattened protobuf: each `!<field><type><value>` token is one
 * value, and an `m` (message) token's value is the number of descendant tokens that follow.
 */

/** Match patterns for the Google Maps pages the extension may read. Also used as host_permissions. */
export const MAPS_URL_PATTERNS = [
  'https://www.google.com/maps*',
  'https://www.google.ca/maps*',
] as const;

const MAPS_HOSTS = new Set(['www.google.com', 'www.google.ca']);

export interface Destination {
  /** Place name from the URL, or null when the URL doesn't name one (e.g. a dropped pin). */
  name: string | null;
  /** Address after the name, when the URL includes one (directions waypoints do). */
  address: string | null;
  lat: number;
  lng: number;
  /**
   * `exact`: the place's own coordinates.
   * `approximate`: the map viewport centre, used when the URL has no place coordinates.
   */
  precision: 'exact' | 'approximate';
}

interface DataNode {
  field: number;
  type: string;
  value: string;
  children: DataNode[];
}

export function isGoogleMapsUrl(rawUrl: string): boolean {
  const url = tryParseUrl(rawUrl);
  return url !== null && isMapsLocation(url);
}

export function parseDestination(rawUrl: string): Destination | null {
  const url = tryParseUrl(rawUrl);
  if (url === null || !isMapsLocation(url)) return null;

  // ['', 'maps', 'place', 'Name', '@lat,lng,zoom', 'data=…'] (empty segments kept on purpose:
  // an empty directions waypoint is meaningful).
  const segments = url.pathname.split('/');
  const mode = segments[2];
  const rest = segments.slice(3);
  const viewportIndex = rest.findIndex((s) => s.startsWith('@') || s.startsWith('data='));
  const named = viewportIndex === -1 ? rest : rest.slice(0, viewportIndex);
  const dataSegment = rest.find((s) => s.startsWith('data='));
  const data = parseDataParam(dataSegment?.slice('data='.length) ?? '');

  if (mode === 'place') {
    const place = { name: decodeSegment(named[0]), address: null };
    const exact = placeCoordinates(data);
    if (exact) return { ...place, ...exact, precision: 'exact' };
    const viewport = viewportCoordinates(rest.find((s) => s.startsWith('@')));
    return viewport ? { ...place, ...viewport, precision: 'approximate' } : null;
  }

  if (mode === 'dir') {
    // The destination is the last waypoint. Without its coordinates (e.g. blank, or typed
    // text Google hasn't resolved), there is no destination to show yet.
    const coords = lastWaypointCoordinates(data);
    if (!coords) return null;
    return { ...splitNameAndAddress(decodeSegment(named.at(-1))), ...coords, precision: 'exact' };
  }

  return null;
}

export function parseDataParam(data: string): DataNode[] {
  const tokens = data.split('!').filter((t) => t.length > 0);
  let index = 0;

  const readUntil = (limit: number): DataNode[] => {
    const nodes: DataNode[] = [];
    while (index < limit) {
      const token = tokens[index++] ?? '';
      const match = /^(\d+)([a-z])(.*)$/.exec(token);
      if (!match) continue;
      const [, field = '', type = '', value = ''] = match;
      const node: DataNode = { field: Number(field), type, value, children: [] };
      if (type === 'm') {
        const count = Number.parseInt(value, 10);
        // Clamp so a malformed count can't read past its parent.
        node.children = readUntil(Math.min(index + (Number.isNaN(count) ? 0 : count), limit));
      }
      nodes.push(node);
    }
    return nodes;
  };

  return readUntil(tokens.length);
}

function placeCoordinates(nodes: DataNode[]): { lat: number; lng: number } | null {
  const pin = child(child(child(nodes, 4, 'm')?.children, 3, 'm')?.children, 8, 'm');
  return coordinates(child(pin?.children, 3, 'd')?.value, child(pin?.children, 4, 'd')?.value);
}

function lastWaypointCoordinates(nodes: DataNode[]): { lat: number; lng: number } | null {
  const route = child(child(nodes, 4, 'm')?.children, 4, 'm');
  const waypoints = route?.children.filter((n) => n.field === 1 && n.type === 'm') ?? [];
  const position = child(waypoints.at(-1)?.children, 2, 'm');
  return coordinates(
    child(position?.children, 2, 'd')?.value,
    child(position?.children, 1, 'd')?.value,
  );
}

function viewportCoordinates(segment: string | undefined): { lat: number; lng: number } | null {
  const match = /^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|$)/.exec(segment ?? '');
  return match ? coordinates(match[1], match[2]) : null;
}

function child(nodes: DataNode[] | undefined, field: number, type: string): DataNode | undefined {
  return nodes?.find((n) => n.field === field && n.type === type);
}

function coordinates(
  latText: string | undefined,
  lngText: string | undefined,
): { lat: number; lng: number } | null {
  if (latText === undefined || lngText === undefined) return null;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Directions waypoints read "Kitchener City Hall, 200 King St W, Kitchener, ON N2G 4G7". */
function splitNameAndAddress(full: string | null): { name: string | null; address: string | null } {
  const comma = full?.indexOf(', ') ?? -1;
  if (full === null || comma === -1) return { name: full, address: null };
  return { name: full.slice(0, comma), address: full.slice(comma + 2) };
}

function decodeSegment(segment: string | undefined): string | null {
  if (!segment) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment.replaceAll('+', ' '));
  } catch {
    return null;
  }
  const trimmed = decoded.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isMapsLocation(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    MAPS_HOSTS.has(url.hostname) &&
    (url.pathname === '/maps' || url.pathname.startsWith('/maps/'))
  );
}
