# Park Lens — Initial Plan

A Chrome extension that shows parking options near the place you're viewing in Google Maps, in a side panel.
MVP scope: **Kitchener and Waterloo, ON**.

```
Parking near Kitchener City Hall
────────────────────────────────
🅿 Lot 12 — Green St                 4 min walk
   $2.75/hr · Sundays free · 78 spaces
🚗 Street parking — Queen St N       2 min walk
   Free · 2 hour max
🚗 Street parking — College St       5 min walk
   Free · 2 hour max
```

---

## 1. What data exists (checked 2026-09-14)

All sources below are public ArcGIS FeatureServers. They can be queried with `f=geojson&outSR=4326`, so no scraping is needed.

| Source | Type | Count | Useful fields | Caveats |
|---|---|---|---|---|
| Kitchener `Parking_On_Street` | polygons | 156 | `STREET`, `NUM_SPACES`, `PARKING_COST` ("2 HOURS FREE"), `MAX_RATE`, `HOURS`, `DAYS` | Mostly downtown. Records were last edited around 2017. Cost is free text. |
| Kitchener `Parking_Public_Lots` | polygons | 52 | `PARKING_FACILITY`, `STREET`, `NUM_SPACES`, `PARKING_COST`, `HOURS`, `ACCESSIBLE_SPACES`, `PARKING_URL` | Includes community-centre lots ("free while at facility"). Records were last edited around 2021. |
| Kitchener `Parking_Features` | points | 477 | pay-and-display machines, signs | Optional; can confirm that a lot is paid. |
| Waterloo `ParkingLots` | polygons | 31 | `NAME`, `ADDRESS`, `CLASS`, `TWOH_FREE`, `HOURLY`, `DESCR` ("2 Hour Free Parking Mon-Fri 8am-6pm") | Uptown only. Many lots are permit-only, and hours are free text. |
| Waterloo `Bylaw_Parking_Infractions` | table (no geometry) | large | `STREET`, `ADDRESS`, `REASON` ("3 HOUR LIMIT POSTED", "PERMIT PARKING ONLY") | Can suggest which streets have signed restrictions. Street name only, no coordinates. |

Service base URLs:
- Kitchener: `https://services1.arcgis.com/qAo1OsXi67t7XgmS/arcgis/rest/services/<name>/FeatureServer/0`
- Waterloo: `https://services.arcgis.com/ZpeBVw5o1kjit7LT/arcgis/rest/services/<name>/FeatureServer/0`

**Gap: the City of Waterloo publishes no on-street parking dataset.** The "Parking On Street" item on Waterloo's portal is actually Kitchener's layer.

Also not covered: private or institutional lots (malls, hospitals, UW/WLU, Laurier, Conestoga), paid on-street spots in Uptown Waterloo, and Region-owned lots. OpenStreetMap (`amenity=parking`) is the likely filler. I couldn't measure its coverage yet because the Overpass API wasn't reachable from this environment.

### Default rules for unsigned streets (same in both cities)

These let the extension say something useful about residential streets that have no data:

- **Maximum 3 hours, 6 a.m.–11 p.m.**, unless signs say otherwise.
- **No parking 2:30–6 a.m.** without an exemption:
  - Kitchener: exemption needed Dec 1 – Mar 31 only.
  - Waterloo: register in advance.
- **Snow event declared:** no street parking at all, and exemptions are cancelled.

This must always be shown as *"typical rule — check posted signs"*, never as fact.

---

### Known data gaps (M2, 2026-09-14)

- These city-run lots are on the cities' parking pages but **not in the open data**, so there's no location for them:
  - Kitchener Rotary (Lot 13), Scott Street (Lot 21) and King Street East (Lot 23)
  - Waterloo's Marsland Centre Lot
  - Adding them needs a hand-entered position.
- **45 downtown Kitchener street segments have unverified rules.**
  - The open data lists them as metered with no rate.
  - The City's page mentions 300+ free two-hour downtown spaces but names no streets.
  - They are kept with `rulesStatus: 'unverified'` and price `unknown`, and must not rank as confirmed free parking until there is street-specific evidence.
- **Waterloo 2-hour-free lots allow longer stays** through HonkMobile ($3.50/hour). The City doesn't say whether the first 2 hours are then charged, so the charge after 2 hours is recorded as unconfirmed (`amount: null`).
- **Open hours stay unstated where the City contradicts itself** (M3). Charles & Benton, Duke & Ontario, Civic District and Lot 9 list hours that exclude days the City also calls free. Their hours are kept as notes, and the build fails if any rule starts outside stated open hours.
- **M6 release preparation.**
  - Version 1.0.0; name "Park Lens"; all rights reserved.
  - **Panel:**
    - loading and error states
    - clearer no-results message
    - "rates and rules checked" date
    - non-affiliation disclaimer
    - short screen-reader announcements instead of a live results list
  - `REPORT_PROBLEM_URL` (`src/shared/links.ts`) is unset; the report link stays hidden until it's set.
  - **Privacy policy** covers the locally stored stay length and outbound links.
  - **Scripts:**
    - `npm run release:check`: report URL, source checks ≤ 90 days, valid version
    - `npm run package`: release zip
    - `npm run store:assets`: 1280×800 screenshots and the 440×280 promo tile from the preview page
  - Store listing draft: `docs/store/listing.md`. Release steps and manual Chrome test: `docs/RELEASE.md`.
  - **Still to do by the owner:** set the report URL, publish the privacy policy at a public URL, and run the manual Chrome test.
- **M5 street parking rules note** (`src/results/street-rules.ts`).
  - General rules per city, worded from each city's bylaw pages (checked 2026-09-14): the 3-hour limit, overnight 2:30–6 a.m. rules, snow events, and Kitchener's downtown 5-hour re-parking rule.
  - Shown below the results as a notice, never as a parking result. It leads with "This isn't a parking spot… always check the signs where you park."
  - The city comes from the parking found near the destination. When that parking spans both cities, or there is none, both cities' rules are shown rather than guessing.
  - Not date-aware yet: Kitchener's December–March overnight rule is shown with its dates rather than highlighted for winter stays.
- **M4 stay planning** (`src/results/stay.ts`, `view.ts`).
  - **Controls:** stay length (30 min, 1, 2, 3, 4 or 8 hr; the last choice is remembered on this device) and arrival (now, or a day in the next week and a time). Times are always Kitchener–Waterloo local.
  - **Evaluation:** the stay is split wherever the applicable rule changes, walking minute by minute, so windows past midnight and closing times are handled.
  - **Outcomes:** fits, partial (with the time you must leave: max stay, permit-only starts, or closing), unknown (from when rules stop being listed), facility visitors only, or not allowed on arrival.
  - **Cost:** priced per stretch from price steps, capped at the daily max.
    - Exact when one paid rule covers the stay.
    - An **estimate** when the stay crosses more than one paid rule (e.g. a garage's day rate into its evening cap). Each stretch is priced separately, so it may differ from what a garage actually charges.
    - **Unconfirmed** whenever any part has an unknown amount.
  - **Ranking:** by outcome, then a score of walk minutes, plus 2 minutes per dollar, plus 6 minutes for an unconfirmed cost, plus up to 10 minutes for the share of the stay a partial fit doesn't cover. Nearest first on ties.
  - Up to 8 results, plus up to 5 unverified street segments in a separate collapsed section. Results that read identically for the stay show once.
  - **Not modelled:** daily maximums resetting at midnight on stays past midnight, holidays, and snow events.
- Rules for times the cities don't mention are left unknown, not assumed free. Examples: weekday evenings at Kitchener surface lots, and 3–6 a.m. in Waterloo lots.
- Kitchener unpaid street and community-centre records still use open-data rules; some haven't been edited since 2017.

## 2. Architecture

```
Google Maps tab ── URL only, via chrome.tabs events (no content script)
        │
        ├──────────────────────────────┐
        ▼                              ▼
┌────────────────────────┐   ┌──────────────────────────┐
│ service worker         │   │ side panel (UI)          │
│ - open panel on click  │   │ - follows active tab     │
│ - "P" badge when a K-W │   │ - destination header     │
│   place is open        │   │ - (M2+) bundled data,    │
└────────────────────────┘   │   search, rules, ranking │
                             └──────────────────────────┘
   both use src/shared: parseDestination() → resolveViewState()
```

### 2.1 Detecting the destination (implemented in M1)

- **No content script.**
  - `host_permissions` are limited to `https://www.google.com/maps*` and `https://www.google.ca/maps*`.
  - Chrome therefore exposes only those tabs' URLs through `chrome.tabs`, including same-document history changes. For every other tab, `tab.url` is `undefined`.
  - Nothing is injected into Google's page, and its DOM is never read.
- **`data=` segment:** a flattened protobuf. Each `!<field><type><value>` token is one value, and an `m` token's value is the number of descendant tokens. `parseDataParam()` rebuilds the tree.
  - **Place** (`/maps/place/<Name>/…`): `4m → 3m → 8m → 3d` lat, `4d` lng.
  - **Directions** (`/maps/dir/<A>/<B>/…`): `4m → 4m →` last `1m` waypoint `→ 2m → 1d` lng, `2d` lat. A blank or unresolved destination means no destination.
- **Fallback:** for a place URL without `data=`, use the `@lat,lng` viewport centre, marked *approximate* in the UI.
- **Name:** the URL-decoded path segment.
- **Service area:** a coarse K-W bounding box (43.36–43.54 N, 80.63–80.37 W). Outside it, the panel says the area isn't covered yet.
- **Updates:** Maps rewrites the URL on every pan, so the panel only re-renders when the resolved state changes.

### 2.2 Side panel

- Use the `chrome.sidePanel` API (Manifest V3).
- `chrome.sidePanel.open()` needs a user gesture, so the panel can't pop open by itself.
  - Set `setPanelBehavior({ openPanelOnActionClick: true })`.
  - Also show a small badge on the toolbar icon when a place is detected.
- Controls:
  - **"How long are you staying?"** chips: 30m / 1h / 2h / 3h / 4h+ / overnight
  - **Arriving:** now, or pick a time
  - **Max walk:** 5 / 10 / 15 min

### 2.3 Data pipeline (no backend for MVP)

The dataset is tiny (about 240 features), so the plan is to **bundle it with the extension**:

1. `scripts/fetch-data.ts` downloads each layer as GeoJSON (WGS84).
2. `scripts/normalize.ts` turns each feature into a common `ParkingOption`.
3. The result is written to `src/data/parking.kw.json`, which gets committed and reviewed by diff.

Refresh by rerunning the script, and a GitHub Action can do it weekly later. A backend only becomes worth it with more cities, crowd reports, or live occupancy.

### 2.4 Normalized model

```ts
type ParkingOption = {
  id: string;
  kind: "street" | "lot" | "garage";
  city: "Kitchener" | "Waterloo";
  name: string;                  // "Lot 12 — Green St" / "Queen St N"
  geometry: GeoJSON.Polygon | GeoJSON.Point;
  entrance: [lng: number, lat: number];   // centroid for now
  spaces?: number;
  accessibleSpaces?: number;
  rules: Rule[];                 // evaluated against arrival time + duration
  source: { dataset: string; updated?: string; url?: string };
  confidence: "official" | "default-bylaw" | "community";
  rawText: string;               // original PARKING_COST / DESCR, shown on expand
};

type Rule = {
  days: number[];                // 0=Sun..6=Sat
  start: string; end: string;    // "08:00", "18:00"
  access: "public" | "permit" | "customers";
  price: { type: "free" } | { type: "hourly"; rate: number; dailyMax?: number } | { type: "flat"; amount: number };
  maxStayMin?: number;
};
```

The hard part is **parsing the free-text cost and hours**, for example:
- `"2.75 PER HOUR / SUNDAYS FREE"`
- `"8:00-24:00 M-S/12:00-24:00 SU"`
- `"$3.00/hr Maximum$16.00/day Mon-Fri 8am-9pm; ..."`

There are only a few dozen distinct strings. Write a small parser, plus a hand-maintained `overrides.json` for strings it can't handle, and unit-test every distinct string.

### 2.5 Search, walk time, ranking

- **Candidates:** everything within about 1.2 km of the destination. With about 240 features, a linear scan is fine; add `rbush` or `kdbush` only when data grows.
- **Walk time (MVP):** straight-line distance × 1.3 detour factor ÷ 80 m/min.
  - Label it "~4 min walk".
  - Later: a routing API (OpenRouteService, or Google Routes API if a key is acceptable) for top results only.
- **Evaluate each option** for the arrival time and duration:
  - `fits`: allowed for the whole stay
  - `partial`: e.g. 2h max but staying 3h → warn
  - `not allowed`: permit-only, or closed
  - Estimated cost for the stay, e.g. 3h × $2.75 = $8.25
- **Rank:**
  1. fits first
  2. then by `walkMin + costWeight × cost`
  3. official data above default-bylaw guesses
  - Hide options that aren't allowed, behind a "show all" toggle.

### 2.6 Tech choices

- TypeScript + Vite + `@crxjs/vite-plugin` (Manifest V3, hot reload)
- Plain TypeScript for the panel (no UI framework), since the UI is small
- `@turf/centroid`, `@turf/distance` (tree-shaken)
- Vitest for parser and rules-engine tests
- Permissions: `sidePanel`, `storage`. Host permissions: Google Maps only. **No `<all_urls>`**, which keeps Chrome Web Store review easy.

---

## 3. Milestones

| # | Milestone | Done when |
|---|---|---|
| **M0** | Scaffold | MV3 extension loads unpacked. The side panel opens from the icon. |
| **M1** | Destination detection | The panel shows the place name and lat/lng, and updates as you click around Maps. Tested on 10 real K-W places. |
| **M2** | Data pipeline | `npm run data` produces a normalized JSON of all lots and streets. Parser tests cover every distinct cost/hours string. |
| **M3** | Nearby list | The panel lists the 5–10 nearest options with walk time, price, and max stay. |
| **M4** | Duration and time-aware | The duration and arrival controls change the results. Permit-only and time-limited spots are flagged correctly. |
| **M5** | Street-rule note | A general informational note about the default 3-hour / overnight street rules, with "check posted signs". Not shown as a parking result. |
| **M6** | Polish and ship | Empty or out-of-area states, a "data last updated" note, a report-a-problem link, icons, a privacy note, and a Web Store listing. |

Possible later work: a map preview in the panel, live occupancy (if the cities expose it), winter snow-event banner, UW/WLU campus lots, Cambridge, and saved favourites.

---

## 4. Risks

- **Stale or partial official data.** Kitchener on-street records were last touched around 2017, and Waterloo has no on-street data. *Mitigation:* always show the source, date, and a "check signs" note, and add a user report button.
- **Google Maps URL format changes.** *Mitigation:* keep parsing in one tested module, with the `@lat,lng` fallback.
- **Wrong advice leads to tickets.** *Mitigation:* confidence labels, conservative wording, and a disclaimer.
- **Side-panel UX.** It can't open automatically. *Mitigation:* a toolbar badge, plus the panel stays open across tab navigation once opened.

---

## 5. Decisions (2026-09-14)

1. **City-run parking only.** No private or commercial lots, and no OpenStreetMap data, in the MVP.
2. **Straight-line walk estimates.** Always labelled as approximate. No routing API.
3. **Built to Chrome Web Store quality.** Minimal permissions, privacy policy, icons, tests and lint. Publishing comes later.
4. **The default 3-hour street rule is a general informational note, never a parking result.** It must tell users to check posted signs.
6. **Open data for locations, city web pages for current rules** (decided during M2).
   - The open data's rates are years out of date: Waterloo's lots were last edited in 2018, and most Kitchener lot rates date from 2019.
   - Locations, names and space counts still come from open data.
   - Rates and hours for paid Kitchener lots and garages, and for all Waterloo uptown lots, come from reviewed overrides in `src/data/overrides.ts`. Each cites the city page it was copied from and the date checked.
   - `data/REPORT.md` lists every override and exclusion.
5. **No content script** (decided during M1). Host permissions scoped to Google Maps URLs let the extension read those tabs' URLs through the `tabs` API. Nothing is injected into Google's page. See §2.1.
