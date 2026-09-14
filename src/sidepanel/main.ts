import { resolveViewState } from '../shared/view-state';
import { renderView } from './render';

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
    const key = JSON.stringify(state);
    // Maps rewrites the URL on every pan; only re-render (and re-announce) real changes.
    if (key === renderedKey) return;
    renderedKey = key;
    root.replaceChildren(renderView(state));
  };

  chrome.tabs.onActivated.addListener((info) => {
    if (info.windowId === windowId) void refresh();
  });
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    const relevant = changeInfo.url !== undefined || changeInfo.status !== undefined;
    if (relevant && tab.active && tab.windowId === windowId) void refresh();
  });

  await refresh();
}

void main();
