import { MAPS_URL_PATTERNS } from '../shared/maps-url';
import { resolveViewState } from '../shared/view-state';

const DEFAULT_TITLE = 'Park Lens';

/**
 * Last badge applied per tab, so the frequent tab updates Google Maps produces (every pan
 * rewrites the URL) don't hit the action API each time. Lost when the worker sleeps, which
 * only costs one redundant update.
 */
const appliedBadges = new Map<number, string>();

// Listeners are registered synchronously so events wake the worker.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
void chrome.action.setBadgeBackgroundColor({ color: '#0F766E' });
void chrome.action.setBadgeTextColor({ color: '#FFFFFF' });

chrome.runtime.onInstalled.addListener(() => void refreshOpenMapsTabs());
chrome.runtime.onStartup.addListener(() => void refreshOpenMapsTabs());

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // tab.url is undefined for non-Maps pages, which clears the badge after navigating away.
  if (changeInfo.url !== undefined || changeInfo.status !== undefined) {
    void updateBadge(tabId, tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => appliedBadges.delete(tabId));

async function refreshOpenMapsTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: [...MAPS_URL_PATTERNS] });
  await Promise.all(
    tabs.flatMap((tab) => (tab.id === undefined ? [] : [updateBadge(tab.id, tab.url)])),
  );
}

async function updateBadge(tabId: number, url: string | undefined): Promise<void> {
  const state = resolveViewState(url);
  const badge =
    state.kind === 'in-area'
      ? { text: 'P', title: `Park Lens: parking near ${state.destination.name ?? 'this location'}` }
      : { text: '', title: DEFAULT_TITLE };

  const key = `${badge.text}|${badge.title}`;
  if (appliedBadges.get(tabId) === key) return;
  appliedBadges.set(tabId, key);

  try {
    await Promise.all([
      chrome.action.setBadgeText({ tabId, text: badge.text }),
      chrome.action.setTitle({ tabId, title: badge.title }),
    ]);
  } catch {
    // The tab closed before the update landed.
    appliedBadges.delete(tabId);
  }
}
