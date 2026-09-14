import type { Destination } from '../shared/maps-url';
import { SERVICE_AREA } from '../shared/service-area';
import type { ViewState } from '../shared/view-state';
import type { NearbyView, ResultItem } from '../results/view';

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

export function renderView(state: ViewState, nearby: NearbyView | null): HTMLElement {
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
      return h('section', 'view', destinationHeader('Parking near', state.destination), ...(nearby ? renderNearby(nearby) : []));
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

function renderNearby(view: NearbyView): HTMLElement[] {
  const unverifiedCount = view.unverified.length;
  return [
    h('p', 'fineprint', `Showing rules for now (${view.timeLabel}).`),
    view.results.length > 0
      ? h('ol', 'results', ...view.results.map(renderItem))
      : h('p', 'placeholder', `No city-run parking found within about a ${String(view.maxWalkMin)}-minute walk.`),
    unverifiedCount > 0
      ? h(
          'details',
          'unverified',
          h('summary', null, `${String(unverifiedCount)} nearby street ${unverifiedCount === 1 ? 'segment' : 'segments'} with unverified rules`),
          h('ol', 'results', ...view.unverified.map(renderItem)),
        )
      : null,
    h(
      'footer',
      'fineprint footer',
      h('p', null, 'Walk times are approximate, based on straight-line distance. City-run parking only. Always check posted signs.'),
      ...view.attributions.map((attribution) => h('p', null, `${attribution}.`)),
    ),
  ].filter((element): element is HTMLElement => element !== null);
}

function renderItem(item: ResultItem): HTMLElement {
  const walk = h('span', 'result__walk', `~${String(item.walkMin)} min walk`);
  walk.setAttribute('aria-label', `About a ${String(item.walkMin)} minute walk`);

  return h(
    'li',
    `result result--${item.availability}`,
    h('div', 'result__header', h('span', 'result__name', item.name), walk),
    h('p', 'result__summary', item.summary),
    h(
      'details',
      'result__details',
      h('summary', null, `${item.kindLabel} · details`),
      item.notes.length > 0 ? h('ul', 'result__notes', ...item.notes.map((note) => h('li', null, note))) : null,
      h('p', 'result__source', item.source),
    ),
  );
}
