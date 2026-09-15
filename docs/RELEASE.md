# Releasing Park Lens

## Before every release

1. **Refresh data.** Run `npm run data`, then review the diff in `src/data/parking.kw.json` and `data/REPORT.md`.
2. **Re-check city sources.**
   - Open each page cited in `src/data/overrides.ts` and `src/results/street-rules.ts`.
   - Update any changed rates or wording, and set their `checked` dates.
   - `npm run release:check` fails when the oldest check is over 90 days old.
3. **Bump the version** in `package.json`; the manifest reads it.
4. **Package.** Run `npm run package`. It runs the release check, typecheck, lint, tests and build, then writes `release/park-lens-<version>.zip`.
5. **Update store assets** if the panel changed: `npm run store:assets`.
6. **Test in real Chrome** (below), using the packaged build.

## Manual test in real Chrome

Automated tests run headless and use the localhost preview, so these checks need a person.

Setup: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and choose `dist/`. Pin Park Lens to the toolbar.

- [ ] **Toolbar icon.** Clicking the Park Lens icon opens the side panel.
- [ ] **Badge.** Opening a Kitchener or Waterloo place in Google Maps shows a **P** badge, and the icon's hover title names the place.
- [ ] **Following the tab.** Clicking another place in Maps updates the panel without reloading.
- [ ] **Directions.** A directions route uses its destination, with the address shown.
- [ ] **Other tabs.** Switching to a non-Maps tab shows "Find parking near your destination", and switching back restores the results.
- [ ] **Outside coverage.** A place outside Kitchener–Waterloo (e.g. CN Tower) shows the coverage message.
- [ ] **Stay controls.** Stay length and Later / day / time change the results. The stay length is remembered after closing and reopening the panel.
- [ ] **Details.** Expanding details shows notes, a timeline when rules change, and the source.
- [ ] **Links.** City source links and "Report a problem" open in a new tab.
- [ ] **Themes.** The panel is readable in Chrome's light and dark themes.
- [ ] **Keyboard.** Tab through the controls: focus is visible, and the chips work with the arrow keys.
- [ ] **Clean console.** No errors in the side panel (right-click → Inspect) or the service worker console on `chrome://extensions`.

## Submitting

- **Upload** the zip in the Chrome Web Store Developer Dashboard.
- **Fill in the listing** using `docs/store/listing.md`: text, screenshots, promo tile, privacy practices and permission justifications.
- **Before the first submission:**
  - Publish `PRIVACY.md` at a public URL, and set the privacy policy and support URLs.
  - Set `REPORT_PROBLEM_URL` in `src/shared/links.ts`.
