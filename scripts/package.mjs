// Zips dist/ into release/park-lens-<version>.zip for upload to the Chrome Web Store.
// Run through `npm run package`, which checks and builds first. Requires the `zip` command.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('dist/manifest.json', root), 'utf8'));

if (manifest.version !== version) {
  throw new Error(`dist/manifest.json is version ${manifest.version}, package.json is ${version}. Rebuild first.`);
}

mkdirSync(new URL('release/', root), { recursive: true });
const output = fileURLToPath(new URL(`release/park-lens-${version}.zip`, root));
rmSync(output, { force: true });
// -X leaves out macOS extended attributes; zipping from inside dist/ puts manifest.json at the root.
execFileSync('zip', ['-r', '-X', '-q', output, '.'], { cwd: fileURLToPath(new URL('dist/', root)), stdio: 'inherit' });
console.log(`Packaged ${output}`);
