// SPDX-License-Identifier: Apache-2.0
// Master cleanup orchestrator. Runs in order:
//   1. Test (baseline — record current state)
//   2. Scan (report findings)
//   3. User confirmation (or --auto-confirm)
//   4. Apply safe cleanups (debug artifacts, line endings)
//   5. Optional: regenerate lockfile (--regen-lock)
//   6. Test (verify nothing essential broke)
//   7. Final scan (show what's still left after cleanup)
//
// Usage:
//   node scripts/cleanup/cleanup.mjs               # interactive
//   node scripts/cleanup/cleanup.mjs --auto-confirm
//   node scripts/cleanup/cleanup.mjs --regen-lock  # also regen lockfile
//   node scripts/cleanup/cleanup.mjs --dry-run

import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const args = process.argv.slice(2);
const autoConfirm = args.includes('--auto-confirm');
const dryRun = args.includes('--dry-run');
const regenLock = args.includes('--regen-lock');

function run(label, cmd, args, { fatal = true } = {}) {
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0 && fatal) {
    console.error(`\n❌ ${label} failed (exit ${r.status})`);
    process.exit(1);
  }
  return r.status === 0;
}

async function confirm(msg) {
  if (autoConfirm) return true;
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(`${msg} [y/N]: `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  Phase 8 Pre-Tag Cleanup');
console.log('═══════════════════════════════════════════════════════════════════');

// Step 1: baseline test
console.log('\n[1/6] Running cleanup tests (baseline)...');
const baselineOk = run('baseline tests', 'node', ['scripts/cleanup/cleanup.test.mjs'], { fatal: false });
if (!baselineOk) {
  console.log('   (Baseline has failures — cleanup will try to address them.)');
}

// Step 2: scan
console.log('\n[2/6] Scanning for cruft...');
run('scan', 'node', ['scripts/cleanup/scan-cruft.mjs'], { fatal: false });

if (dryRun) {
  console.log('\n--dry-run: stopping before any modifications.');
  process.exit(0);
}

// Step 3: confirm
const proceed = await confirm('\nProceed with safe cleanup actions?');
if (!proceed) {
  console.log('Aborted.');
  process.exit(0);
}

// Step 4: safe cleanups
console.log('\n[3/6] Removing debug artifacts...');
run('debug artifacts', 'node', ['scripts/cleanup/clean-debug-artifacts.mjs']);

console.log('\n[4/6] Normalizing line endings...');
run('line endings', 'node', ['scripts/cleanup/normalize-line-endings.mjs']);

// Step 5: optional lockfile regen
if (regenLock) {
  console.log('\n[5/6] Regenerating lockfile (--regen-lock)...');
  if (await confirm('   This will remove node_modules and reinstall. Continue?')) {
    run('lockfile regen', 'node', ['scripts/cleanup/regenerate-lockfile.mjs']);
  } else {
    console.log('   Skipped.');
  }
}

// Step 6: final test
console.log('\n[6/6] Verifying cleanup did not break anything...');
const finalOk = run('final tests', 'node', ['scripts/cleanup/cleanup.test.mjs'], { fatal: false });

// Final scan
console.log('\n══ Final state ══');
run('final scan', 'node', ['scripts/cleanup/scan-cruft.mjs'], { fatal: false });

if (finalOk) {
  console.log('\n✅ Cleanup complete — repo is ready for v0.8.0 tag.');
} else {
  console.log('\n⚠ Cleanup ran but some tests still fail. Review above output.');
  process.exit(1);
}
