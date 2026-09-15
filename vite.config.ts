import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';
import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'chrome116',
    // Chrome supports module preload natively; the polyfill would add an unneeded fetch() call.
    modulePreload: { polyfill: false },
  },
});
