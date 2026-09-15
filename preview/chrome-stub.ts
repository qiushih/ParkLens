// Dev-only stand-in for the few Chrome extension APIs the side panel uses, so the real panel code
// can run on a localhost page. Never bundled into the extension (see vite.preview.config.ts).

type UpdatedListener = Parameters<typeof chrome.tabs.onUpdated.addListener>[0];
type ActivatedListener = Parameters<typeof chrome.tabs.onActivated.addListener>[0];

/** Tab URLs to simulate. `undefined` is how Chrome reports a tab the extension can't see (not Google Maps). */
export const PREVIEW_PLACES: readonly { label: string; url: string | undefined }[] = [
  {
    label: 'Kitchener City Hall (place)',
    url: 'https://www.google.com/maps/place/Kitchener+City+Hall/@43.4517589,-80.4924168,17z/data=!3m1!4b1!4m6!3m5!1s0x882bf4f34212bd1d:0x9f4531228938787d!8m2!3d43.4517589!4d-80.4924168!16zL20vMDcwZm44',
  },
  {
    label: 'Waterloo Public Square (place)',
    url: 'https://www.google.com/maps/place/Waterloo+Public+Square/@43.4639429,-80.5223647,17z/data=!4m6!3m5!1s0x0:0x0!8m2!3d43.4639429!4d-80.5223647!16s',
  },
  {
    label: 'Directions: University of Waterloo → Kitchener City Hall',
    url: 'https://www.google.com/maps/dir/University+of+Waterloo,+200+University+Ave+W,+Waterloo,+ON+N2L+3G1/Kitchener+City+Hall,+200+King+St+W,+Kitchener,+ON+N2G+4G7/@43.4616482,-80.5678258,13z/data=!3m1!4b1!4m13!4m12!1m5!1m1!1s0x882bf6ad02edccff:0xdd9df23996268e17!2m2!1d-80.5448576!2d43.4722854!1m5!1m1!1s0x882bf4f34212bd1d:0x9f4531228938787d!2m2!1d-80.4923578!2d43.4518913',
  },
  { label: 'CN Tower, Toronto (outside coverage)', url: 'https://www.google.com/maps/place/CN+Tower/@43.6426,-79.3871,16z' },
  { label: 'Browsing the map (no place selected)', url: 'https://www.google.com/maps/@43.46,-80.52,14z' },
  { label: 'Not a Google Maps tab', url: undefined },
];

const TAB_ID = 1;
const WINDOW_ID = 1;

let currentUrl = PREVIEW_PLACES[0]?.url;
const updatedListeners: UpdatedListener[] = [];
const activatedListeners: ActivatedListener[] = [];

const tab = () => ({ id: TAB_ID, windowId: WINDOW_ID, active: true, url: currentUrl }) as chrome.tabs.Tab;

const stub = {
  windows: {
    getCurrent: () => Promise.resolve({ id: WINDOW_ID }),
  },
  tabs: {
    query: () => Promise.resolve([tab()]),
    onUpdated: { addListener: (listener: UpdatedListener) => updatedListeners.push(listener) },
    onActivated: { addListener: (listener: ActivatedListener) => activatedListeners.push(listener) },
  },
};

(globalThis as unknown as { chrome: unknown }).chrome = stub;

/** Simulates the active tab navigating, the way Google Maps rewrites its URL. */
export function setPreviewUrl(url: string | undefined): void {
  currentUrl = url;
  for (const listener of updatedListeners) listener(TAB_ID, { status: 'complete' }, tab());
}
