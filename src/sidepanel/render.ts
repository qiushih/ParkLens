import { formatMonthYear } from '../results/format';
import { STREET_RULES_DISCLAIMER, type StreetRulesNote } from '../results/street-rules';
import type { NearbyView, ResultItem } from '../results/view';
import { REPORT_PROBLEM_URL } from '../shared/links';
import type { Destination } from '../shared/maps-url';
import { SERVICE_AREA } from '../shared/service-area';
import type { ViewState } from '../shared/view-state';
import { h } from './dom';

export interface RenderedView {
  /** The destination header, shown above the controls; null when there is no destination. */
  header: HTMLElement | null;
  body: HTMLElement;
}

const DISCLAIMER = 'Not affiliated with or endorsed by Google, the City of Kitchener or the City of Waterloo.';

export function renderView(state: ViewState, nearby: NearbyView | null): RenderedView {
  switch (state.kind) {
    case 'no-maps-tab':
      return {
        header: null,
        body: message('Find parking near your destination', 'Open Google Maps and select a place in Kitchener or Waterloo, ON.'),
      };
    case 'no-destination':
      return {
        header: null,
        body: message('Select a place', 'Search for or click a place in Google Maps to see parking nearby.'),
      };
    case 'outside-area':
      return {
        header: destinationHeader('Selected place', state.destination),
        body: h('p', 'notice', `Park Lens currently covers ${SERVICE_AREA.label} only.`),
      };
    case 'in-area':
      return {
        header: destinationHeader('Parking near', state.destination),
        body: nearby ? renderNearby(nearby) : h('div', null),
      };
  }
}

/** Shown instead of a blank panel if anything goes wrong while building the view. */
export function renderError(): RenderedView {
  return {
    header: null,
    body: h(
      'section',
      'view view--empty',
      h('h1', 'title', "Couldn't show parking"),
      h('p', 'muted', 'Something went wrong. Try selecting the place in Google Maps again.'),
      reportLink(),
    ),
  };
}

/** A short line for screen readers, so they don't re-read the whole panel on every change. */
export function announcementFor(state: ViewState, nearby: NearbyView | null): string {
  switch (state.kind) {
    case 'no-maps-tab':
      return 'Open Google Maps to find parking.';
    case 'no-destination':
      return 'Select a place in Google Maps to see parking nearby.';
    case 'outside-area':
      return `${state.destination.name ?? 'This place'} is outside ${SERVICE_AREA.label}.`;
    case 'in-area': {
      const count = nearby?.results.length ?? 0;
      const place = state.destination.name ?? 'the selected place';
      return `${String(count)} parking ${count === 1 ? 'option' : 'options'} near ${place}${nearby ? `, for a ${nearby.stayLabel}` : ''}`;
    }
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
    destination.precision === 'approximate' ? h('p', 'muted', 'Approximate location, based on the map centre.') : null,
  );
}

function renderNearby(view: NearbyView): HTMLElement {
  const unverifiedCount = view.unverified.length;
  return h(
    'section',
    'view',
    // Labels can already end in "a.m." / "p.m.".
    h('p', 'fineprint', view.stayLabel.endsWith('.') ? `For a ${view.stayLabel}` : `For a ${view.stayLabel}.`),
    view.results.length > 0
      ? h('ol', 'results', ...view.results.map(renderItem))
      : h(
          'p',
          'placeholder',
          `No city-run parking found within about a ${String(view.maxWalkMin)}-minute walk. Park Lens only includes parking run by the cities of Kitchener and Waterloo.`,
        ),
    unverifiedCount > 0
      ? h(
          'details',
          'unverified',
          h('summary', null, `${String(unverifiedCount)} nearby street ${unverifiedCount === 1 ? 'segment' : 'segments'} with unverified rules`),
          h('ol', 'results', ...view.unverified.map(renderItem)),
        )
      : null,
    renderStreetRules(view.streetRules),
    h(
      'footer',
      'fineprint footer',
      h('p', null, 'Walk times are approximate, based on straight-line distance. Costs are estimates from city rates. City-run parking only. Always check posted signs.'),
      view.dataChecked
        ? h('p', null, `Rates and rules were checked against city websites in ${view.dataChecked}. They can change without notice.`)
        : null,
      ...view.attributions.map((attribution) => h('p', null, `${attribution}.`)),
      h('p', null, DISCLAIMER),
      reportLink(),
    ),
  );
}

/** An informational note, visually distinct from results, that leads with checking posted signs. */
function renderStreetRules(notes: readonly StreetRulesNote[]): HTMLElement {
  const [only] = notes;
  const title = notes.length === 1 && only ? `General street parking rules in ${only.city}` : 'General street parking rules';

  const section = h(
    'section',
    'street-rules',
    h('h2', 'street-rules__title', title),
    h('p', 'street-rules__signs', STREET_RULES_DISCLAIMER),
    ...notes.flatMap((note) => [
      notes.length > 1 ? h('h3', 'street-rules__city', note.city) : null,
      h('ul', 'street-rules__list', ...note.points.map((point) => h('li', null, point))),
      h(
        'p',
        'street-rules__source',
        'Source: ',
        ...note.sources.flatMap((source, index) => [index > 0 ? ' and ' : '', link(source.url, source.label)]),
        `, checked ${formatMonthYear(note.checked)}.`,
      ),
    ]),
  );
  section.setAttribute('aria-label', title);
  return section;
}

function reportLink(): HTMLElement | null {
  return REPORT_PROBLEM_URL ? h('p', 'report', link(REPORT_PROBLEM_URL, 'Report a problem')) : null;
}

function link(href: string, text: string): HTMLAnchorElement {
  const anchor = h('a', null, text);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function renderItem(item: ResultItem): HTMLElement {
  const walk = h('span', 'result__walk', `~${String(item.walkMin)} min walk`);
  walk.setAttribute('aria-label', `About a ${String(item.walkMin)} minute walk`);

  return h(
    'li',
    `result result--${item.fit}`,
    h('div', 'result__header', h('span', 'result__name', item.name), walk),
    h('p', 'result__headline', item.headline),
    item.atArrival === item.headline ? null : h('p', 'result__summary', `On arrival: ${item.atArrival}`),
    h(
      'details',
      'result__details',
      h('summary', null, `${item.kindLabel} · details`),
      item.timeline.length > 0 ? h('ul', 'result__list', ...item.timeline.map((line) => h('li', null, line))) : null,
      item.notes.length > 0 ? h('ul', 'result__list', ...item.notes.map((note) => h('li', null, note))) : null,
      h('p', 'result__source', item.source),
    ),
  );
}
