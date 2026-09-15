// Renders Chrome Web Store assets into docs/store/:
//   - 1280×800 screenshots of the real side panel code (preview page with simulated tab APIs)
//   - the 440×280 small promo tile
// Stay choices are fixed so screenshots don't depend on when the script runs.
// Usage: npm run store:assets
/* global document, HTMLElement -- used inside page.evaluate(), which runs in the browser */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const OUT_DIR = new URL('../docs/store/', import.meta.url);
const PORT = 5175;
const BASE = `http://localhost:${String(PORT)}`;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SHOTS = [
  {
    file: 'screenshot-1-kitchener.png',
    place: 0,
    headline: 'City parking near your Google Maps destination',
    duration: '3 hr',
    day: 'Tuesday',
    time: '10:00',
  },
  {
    file: 'screenshot-2-waterloo.png',
    place: 1,
    headline: 'Plan by arrival time and stay length',
    duration: '2 hr',
    day: 'Saturday',
    time: '12:00',
  },
  {
    file: 'screenshot-3-street-rules.png',
    place: 0,
    headline: 'General street rules, with a reminder to check posted signs',
    duration: '2 hr',
    day: 'Tuesday',
    time: '10:00',
    // Start at the unverified-segments line so the street rules note sits below a clean edge.
    scrollTo: '.unverified',
  },
];

/** Day-picker index for a weekday: offsets count from today in Kitchener–Waterloo. */
function dayOffset(weekday) {
  const today = WEEKDAYS.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', weekday: 'long' }).format(new Date()));
  return (WEEKDAYS.indexOf(weekday) - today + 7) % 7;
}

mkdirSync(OUT_DIR, { recursive: true });
const server = await createServer({ configFile: 'vite.preview.config.ts', server: { port: PORT, strictPort: true } });
await server.listen();
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  page.on('pageerror', (error) => {
    throw error;
  });

  for (const shot of SHOTS) {
    const query = new URLSearchParams({ place: String(shot.place), headline: shot.headline });
    await page.goto(`${BASE}/preview/store.html?${query.toString()}`);
    await page.locator('#controls:not([hidden])').waitFor();
    await page.getByText(shot.duration, { exact: true }).click();
    await page.getByText('Later', { exact: true }).click();
    await page.locator('select[name="day"]').selectOption(String(dayOffset(shot.day)));
    await page.locator('input[name="time"]').fill(shot.time);
    // Drop focus so the screenshot doesn't show a focused, highlighted time field.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.waitForTimeout(300);
    if (shot.scrollTo) {
      await page.evaluate((selector) => {
        const frame = document.querySelector('.store-frame');
        const target = document.querySelector(selector);
        if (frame instanceof HTMLElement && target instanceof HTMLElement) frame.scrollTop = target.offsetTop - 16;
      }, shot.scrollTo);
    }
    await page.screenshot({ path: new URL(shot.file, OUT_DIR).pathname });
    console.log(`docs/store/${shot.file}`);
  }

  await page.setViewportSize({ width: 440, height: 280 });
  await page.goto(`${BASE}/preview/promo.html`);
  await page.screenshot({ path: new URL('promo-small-440x280.png', OUT_DIR).pathname });
  console.log('docs/store/promo-small-440x280.png');
} finally {
  await browser.close();
  await server.close();
}
