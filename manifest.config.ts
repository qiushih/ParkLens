import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };
import { MAPS_URL_PATTERNS } from './src/shared/maps-url.ts';

export default defineManifest({
  manifest_version: 3,
  name: 'Park Lens',
  description:
    "See city parking near the place you're viewing in Google Maps. Covers Kitchener and Waterloo, ON.",
  version: pkg.version,
  // chrome.sidePanel with openPanelOnActionClick is stable from 116.
  minimum_chrome_version: '116',
  icons: {
    16: 'src/assets/icons/icon-16.png',
    32: 'src/assets/icons/icon-32.png',
    48: 'src/assets/icons/icon-48.png',
    128: 'src/assets/icons/icon-128.png',
  },
  action: {
    default_title: 'Park Lens',
    default_icon: {
      16: 'src/assets/icons/icon-16.png',
      32: 'src/assets/icons/icon-32.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['sidePanel'],
  // Scoped to Google Maps pages only: this is what lets the extension read
  // those tabs' URLs. It cannot see the URL of any other site.
  host_permissions: [...MAPS_URL_PATTERNS],
});
