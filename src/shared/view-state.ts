import { isGoogleMapsUrl, parseDestination, type Destination } from './maps-url';
import { isInServiceArea } from './service-area';

export type ViewState =
  | { kind: 'no-maps-tab' }
  | { kind: 'no-destination' }
  | { kind: 'outside-area'; destination: Destination }
  | { kind: 'in-area'; destination: Destination };

/**
 * What the extension should show for a tab URL. The URL is undefined for tabs the
 * extension has no host permission for, i.e. anything that isn't Google Maps.
 */
export function resolveViewState(url: string | undefined): ViewState {
  if (url === undefined || !isGoogleMapsUrl(url)) return { kind: 'no-maps-tab' };
  const destination = parseDestination(url);
  if (!destination) return { kind: 'no-destination' };
  return isInServiceArea(destination)
    ? { kind: 'in-area', destination }
    : { kind: 'outside-area', destination };
}
