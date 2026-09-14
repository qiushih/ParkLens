import type { Destination } from '../shared/maps-url';
import { SERVICE_AREA } from '../shared/service-area';
import type { ViewState } from '../shared/view-state';

type Child = Node | string | null;

/** Builds an element. Strings become text nodes, so URL-derived text is never parsed as HTML. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children.filter((c): c is Node | string => c !== null));
  return element;
}

export function renderView(state: ViewState): HTMLElement {
  switch (state.kind) {
    case 'no-maps-tab':
      return message(
        'Find parking near your destination',
        'Open Google Maps and select a place in Kitchener or Waterloo, ON.',
      );
    case 'no-destination':
      return message(
        'Select a place',
        'Search for or click a place in Google Maps to see parking nearby.',
      );
    case 'outside-area':
      return h(
        'section',
        'view',
        destinationHeader('Selected place', state.destination),
        h('p', 'notice', `Park Lens currently covers ${SERVICE_AREA.label} only.`),
      );
    case 'in-area':
      return h(
        'section',
        'view',
        destinationHeader('Parking near', state.destination),
        h('p', 'placeholder', 'Nearby city parking options will appear here.'),
      );
  }
}

function message(title: string, body: string): HTMLElement {
  return h('section', 'view view--empty', h('h1', 'title', title), h('p', 'muted', body));
}

function destinationHeader(eyebrow: string, destination: Destination): HTMLElement {
  return h(
    'header',
    'destination',
    h('p', 'eyebrow', eyebrow),
    h('h1', 'title', destination.name ?? 'Dropped pin'),
    destination.address ? h('p', 'muted', destination.address) : null,
    h('p', 'coords', `${destination.lat.toFixed(5)}, ${destination.lng.toFixed(5)}`),
    destination.precision === 'approximate'
      ? h('p', 'muted', 'Approximate location, based on the map centre.')
      : null,
  );
}
