import { PARKING_DATASET } from '../data/bundled';
import { buildNearbyView } from '../results/view';
import { resolveViewState } from '../shared/view-state';
import { renderView } from './render';

/** Statuses depend on the time of day, so re-check periodically; unchanged views aren't re-rendered. */
const CLOCK_REFRESH_MS = 30_000;

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('Side panel root #app is missing');

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

    const state = resolveViewState(tab?.url);
    const nearby = state.kind === 'in-area' ? buildNearbyView(PARKING_DATASET, state.destination, new Date()) : null;
    const key = JSON.stringify([state, nearby]);
    // Maps rewrites the URL on every pan; only re-render (and re-announce) real changes. This also
    // keeps expanded details open across clock refreshes that change nothing.
    if (key === renderedKey) return;
    renderedKey = key;
    root.replaceChildren(renderView(state, nearby));
  };

  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === windowId) void refresh();
  });
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    const relevant = changeInfo.url !== undefined || changeInfo.status !== undefined;
    if (relevant && tab.active && tab.windowId === windowId) void refresh();
  });
  setInterval(() => void refresh(), CLOCK_REFRESH_MS);

  await refresh();
}

void main();
