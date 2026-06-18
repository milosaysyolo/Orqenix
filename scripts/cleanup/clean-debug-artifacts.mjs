// SPDX-License-Identifier: Apache-2.0
// Removes debug artifacts left at repo root from verify cycles.
// SAFE: only removes files matching specific known patterns.
// Idempotent: runs as no-op if already clean.

import { readdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const PATTERNS = [
  /^verify-report\.json$/,
  /^test-report\.json$/,
  /^test-failure-.*\.json$/,
  /^post-fix-capture-report\.json$/,
  /^pro-verify\.log$/,
  /^.*\.tmp$/,
  /^.*\.bak$/,
  /^debug-.*\.(log|json|txt)$/,
  /^npm-debug\.log$/,
  /^pnpm-debug\.log$/,
];

const files = await readdir(ROOT);
const removed = [];

for (const f of files) {
  if (PATTERNS.some((p) => p.test(f))) {
    try {
      await unlink(join(ROOT, f));
      removed.push(f);
      console.log(`  removed: ${f}`);
    } catch (err) {
      console.warn(`  skip: ${f} (${err.message})`);
    }
  }
}

console.log(`\n${removed.length} debug artifact(s) removed.`);
if (removed.length === 0) console.log('Repo root is clean.');
