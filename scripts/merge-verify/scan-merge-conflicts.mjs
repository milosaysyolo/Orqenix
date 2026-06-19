// SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { PHASE_REGISTRY } from './phase-registry.mjs';

const ROOT = process.cwd();
let problems = 0;

console.log('Scanning for leftover git conflict markers...');
try {
  const sources = execSync('git ls-files "**/*.ts" "**/*.tsx" "**/*.mjs" "**/*.json" "**/*.yaml" "**/*.md"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter((p) => p && !p.includes('node_modules') && !p.includes('dist/'));
  for (const rel of sources) {
    try {
      const content = await readFile(join(ROOT, rel), 'utf-8');
      if (/^<{7}|^={7}$|^>{7}/m.test(content)) {
        console.error(`CONFLICT MARKER in ${rel}`);
        problems += 1;
      }
    } catch {}
  }
  if (problems === 0) console.log('  OK No conflict markers');
} catch {}

console.log('\nScanning for duplicate package names...');
try {
  const pkgFiles = execSync('git ls-files "**/package.json"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter((p) => p && !p.includes('node_modules'));
  const names = new Map();
  for (const rel of pkgFiles) {
    const pkg = JSON.parse(await readFile(join(ROOT, rel), 'utf-8'));
    if (!pkg.name) continue;
    const list = names.get(pkg.name) ?? [];
    list.push(rel);
    names.set(pkg.name, list);
  }
  for (const [name, files] of names) {
    if (files.length > 1) {
      console.error(`DUPLICATE PACKAGE: ${name} in ${files.join(', ')}`);
      problems += 1;
    }
  }
  if (problems === 0) console.log('  OK No duplicate package names');
} catch {}

console.log('\nVerifying phase contract packages are present...');
for (const [phaseId, phase] of Object.entries(PHASE_REGISTRY)) {
  for (const pkg of phase.provides.packages) {
    const found = (() => {
      try {
        execSync(`pnpm --filter "${pkg}" list --depth -1 2>&1`, { cwd: ROOT, encoding: 'utf-8' });
        return true;
      } catch {
        return false;
      }
    })();
    if (!found) {
      console.error(`${phaseId}: package ${pkg} not found in workspace`);
      problems += 1;
    }
  }
}
if (problems === 0) console.log('  OK All phase contract packages present');

console.log(`\n[scan-merge-conflicts] ${problems} problem(s).`);
process.exit(problems > 0 ? 1 : 0);
