import { PARKING_DATASET } from '../data/bundled';
import { dayOptionLabels, resolveStay } from '../results/stay-request';
import { buildNearbyView } from '../results/view';
import { resolveViewState } from '../shared/view-state';
import { createControls } from './controls';
import { renderView } from './render';

/** Statuses depend on the time of day, so re-check periodically; unchanged views aren't re-rendered. */
const CLOCK_REFRESH_MS = 30_000;

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Side panel element #${id} is missing`);
  return element;
}

async function main(): Promise<void> {
  const headerRoot = requireElement('destination');
  const controlsRoot = requireElement('controls');
  const resultsRoot = requireElement('app');

  const controls = createControls(new Date());
  controlsRoot.append(controls.element);

  // The panel belongs to one window and follows that window's active tab.
  const { id: windowId } = await chrome.windows.getCurrent();
  let renderedKey = '';
  let latestRequest = 0;

  const refresh = async (): Promise<void> => {
    const request = ++latestRequest;
    const [tab] = await chrome.tabs.query(
      windowId === undefined ? { active: true, currentWindow: true } : { active: true, windowId },
    );
    // A newer refresh started while this one awaited; let it win.
    if (request !== latestRequest) return;

    const now = new Date();
    const state = resolveViewState(tab?.url);
    let nearby = null;
    if (state.kind === 'in-area') {
      controls.setDayLabels(dayOptionLabels(now));
      const stay = resolveStay(controls.read(), now);
      nearby = buildNearbyView(PARKING_DATASET, state.destination, stay.request, stay.label);
    }
    controlsRoot.hidden = state.kind !== 'in-area';

    // Maps rewrites the URL on every pan; only re-render (and re-announce) real changes. This also
    // keeps expanded details open across clock refreshes that change nothing.
    const key = JSON.stringify([state, nearby]);
    if (key === renderedKey) return;
    renderedKey = key;

    const { header, body } = renderView(state, nearby);
    headerRoot.replaceChildren(...(header ? [header] : []));
    resultsRoot.replaceChildren(body);
  };

  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === windowId) void refresh();
  });
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    const relevant = changeInfo.url !== undefined || changeInfo.status !== undefined;
    if (relevant && tab.active && tab.windowId === windowId) void refresh();
  });
  controls.onChange(() => void refresh());
  setInterval(() => void refresh(), CLOCK_REFRESH_MS);

  await refresh();
}

void main();
