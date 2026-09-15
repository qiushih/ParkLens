// Fails if the project isn't ready to package for the Chrome Web Store.
// Usage: npm run release:check (also run by npm run package)
import { readFile } from 'node:fs/promises';
import { OVERRIDES } from '../src/data/overrides.ts';
import { STREET_RULES } from '../src/results/street-rules.ts';
import { REPORT_PROBLEM_URL } from '../src/shared/links.ts';
import { releaseProblems } from './release-checks.ts';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

const problems = releaseProblems({
  version,
  reportProblemUrl: REPORT_PROBLEM_URL,
  checkedDates: [
    ...Object.values(OVERRIDES).flatMap((override) => (override.sourceUrl ? [override.checked] : [])),
    ...Object.values(STREET_RULES).map((note) => note.checked),
  ],
  today: new Date(),
});

if (problems.length > 0) {
  console.error(`Not ready to release ${version}:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`Ready to release ${version}.`);
