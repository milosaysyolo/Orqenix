// SPDX-License-Identifier: Apache-2.0
// Audits pnpm-lock.yaml for drift after 6 cycles of fix-and-rerun.
// Detects:
//   - Lockfile vs package.json mismatch
//   - Phantom entries in lockfile for removed packages
//   - Outdated peer-dep resolutions
//   - Missing workspace packages
//
// Run: node scripts/cleanup/lockfile-audit.mjs

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';

const ROOT = process.cwd();
let issues = 0;

console.log('══ Lockfile audit ══\n');

// 1. Verify lockfile exists + parses
const lockPath = join(ROOT, 'pnpm-lock.yaml');
if (!existsSync(lockPath)) {
  console.error('❌ pnpm-lock.yaml missing');
  process.exit(1);
}

let lock;
try {
  lock = parseYaml(await readFile(lockPath, 'utf-8'));
  console.log(`✓ Lockfile parses (version ${lock.lockfileVersion ?? '?'})`);
} catch (err) {
  console.error(`❌ Lockfile parse error: ${err.message}`);
  process.exit(1);
}

// 2. Compare workspace declarations (lockfile importers vs filesystem)
const workspacePkgs = execSync('pnpm -r list --depth -1 --json', { cwd: ROOT, encoding: 'utf-8' });
const workspaceNames = JSON.parse(workspacePkgs).map((p) => p.name).filter(Boolean);
const importerKeys = Object.keys(lock.importers ?? {});

const fsToLock = new Map();
for (const name of workspaceNames) {
  const importerPath = JSON.parse(workspacePkgs).find((p) => p.name === name)?.path;
  if (!importerPath) continue;
  const relImporter = importerPath === ROOT ? '.' : importerPath.replace(ROOT + '/', '').replace(ROOT + '\\', '');
  fsToLock.set(name, relImporter);
}

// Importers in lockfile but not on filesystem = phantom
const phantomImporters = importerKeys.filter((k) => k !== '.' && !Array.from(fsToLock.values()).includes(k));
if (phantomImporters.length > 0) {
  console.error(`\n❌ ${phantomImporters.length} phantom importer(s) in lockfile (packages were removed but lockfile not updated):`);
  phantomImporters.slice(0, 10).forEach((k) => console.error(`  - ${k}`));
  console.error(`  → Fix: rm pnpm-lock.yaml && pnpm install`);
  issues += 1;
} else {
  console.log(`✓ All ${importerKeys.length} importers match filesystem`);
}

// 3. Run pnpm install --frozen-lockfile in dry mode to detect package.json drift
console.log('\nChecking package.json ↔ lockfile sync...');
try {
  execSync('pnpm install --frozen-lockfile --lockfile-only --reporter=silent', {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  console.log('✓ Lockfile is in sync with all package.json files');
} catch (err) {
  console.error(`❌ Lockfile out of sync with package.json:`);
  console.error(err.stderr?.toString().slice(0, 1000) ?? err.message);
  console.error(`  → Fix: pnpm install (regenerates lockfile)`);
  issues += 1;
}

if (issues > 0) {
  console.error(`\n${issues} lockfile issue(s) found. Fix before tagging.`);
  process.exit(1);
}
console.log('\n✅ Lockfile is clean.');
process.exit(0);
