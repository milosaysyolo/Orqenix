// SPDX-License-Identifier: Apache-2.0
// Regenerates pnpm-lock.yaml cleanly. Preserves resolution but removes any
// phantom entries from packages that were renamed or removed.
//
// Run: node scripts/cleanup/regenerate-lockfile.mjs

import { existsSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const lockPath = join(ROOT, 'pnpm-lock.yaml');
const backupPath = join(ROOT, 'pnpm-lock.yaml.backup');

console.log('Regenerating pnpm-lock.yaml...\n');

// 1. Backup current lockfile
if (existsSync(lockPath)) {
  copyFileSync(lockPath, backupPath);
  console.log('✓ Backed up to pnpm-lock.yaml.backup');
}

// 2. Remove lockfile + node_modules
console.log('  Removing lockfile + node_modules...');
if (existsSync(lockPath)) unlinkSync(lockPath);

// 3. Run install to regenerate
console.log('  Running pnpm install...');
try {
  execSync('pnpm install', { cwd: ROOT, stdio: 'inherit' });
  console.log('\n✓ Lockfile regenerated cleanly.');
  console.log('  Backup retained at pnpm-lock.yaml.backup (delete after verifying).');
} catch (err) {
  console.error(`\n❌ Install failed: ${err.message}`);
  if (existsSync(backupPath)) {
    copyFileSync(backupPath, lockPath);
    console.error('  Restored backup lockfile.');
  }
  process.exit(1);
}
