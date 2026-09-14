# ParkLens

A Chrome extension that shows city parking near the place you're viewing in Google Maps, in a side panel. Coverage: **Kitchener and Waterloo, ON**.

> **Status:** milestones M0–M1 are done (extension scaffold and Google Maps destination detection). Parking results come in later milestones. See [docs/PLAN.md](docs/PLAN.md).

## How it works

1. Open [Google Maps](https://www.google.com/maps) and select a place, or get directions to one.
2. When the place is in Kitchener or Waterloo, the toolbar icon shows a **P** badge.
3. Click the Park Lens icon to open the side panel. It follows the active tab as you browse.

Park Lens reads only the **URL** of Google Maps tabs. It never reads or changes the page, and it sends nothing anywhere. See [PRIVACY.md](PRIVACY.md).

## Development

Requires Node 22.12+ and Chrome 116+.

```bash
npm install
```

```bash
npm run dev
```

Then load the extension:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.

`npm run dev` rebuilds on change.

| Script | What it does |
|---|---|
| `npm run dev` | Development build with hot reload into `dist/` |
| `npm run build` | Type-check and production build into `dist/` |
| `npm run check` | Type-check, lint, and unit tests |
| `npm test` | Unit tests (Vitest) |
| `npm run icons` | Regenerate the PNG icons in `src/assets/icons/` |

## Project layout

```
manifest.config.ts         Manifest V3 definition (version comes from package.json)
src/
  background/              Service worker: side-panel behaviour, toolbar badge
  sidepanel/               Side panel UI (plain TypeScript + CSS)
  shared/
    maps-url.ts            Google Maps URL → destination (name, lat/lng, precision)
    service-area.ts        Kitchener–Waterloo bounding box
    view-state.ts          Tab URL → what the UI should show
  assets/icons/            Generated icons
scripts/generate-icons.mjs
docs/PLAN.md               Product and technical plan, milestones, decisions
```

## Permissions

| Permission | Why |
|---|---|
| `sidePanel` | Show the Park Lens panel next to Google Maps. |
| Host access to `www.google.com/maps*` and `www.google.ca/maps*` | Read the URL of Google Maps tabs to find the destination. No other site's URL is visible to the extension. |
