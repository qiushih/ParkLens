import { defineConfig } from 'vite';

// Serves preview/index.html on localhost: the side panel with simulated Chrome APIs.
// Deliberately without the CRXJS plugin, so nothing here ends up in the extension build.
export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
  },
});
