// SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const isWin = process.platform === 'win32';
function run(label, cmd, args, { fatal = false } = {}) {
  process.stdout.write(`\n> ${label}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin });
  const ok = r.status === 0;
  process.stdout.write(`${ok ? 'OK' : 'FAIL'} ${label}\n`);
  return { label, ok, fatal };
}

const results = [];

console.log('═══════════════════════════════════════════════════════════════════');
console.log('  Post-Merge Cross-Phase Verification (Phase 1 to Phase 8)');
console.log('═══════════════════════════════════════════════════════════════════');

results.push(run('Merge conflict scan', 'node', ['scripts/merge-verify/scan-merge-conflicts.mjs'], { fatal: true }));
if (!results[results.length - 1].ok) {
  console.error('\nFAIL Merge conflicts detected. Resolve before running phase tests.');
  finalize();
  process.exit(1);
}

results.push(run('Install', 'pnpm', ['install'], { fatal: true }));
results.push(run('Rebuild native modules', 'pnpm', ['rebuild', 'better-sqlite3']));
results.push(run('Build (all packages)', 'pnpm', ['-r', '--no-bail', 'run', 'build']));

results.push(run('Migration ordering', 'pnpm', ['vitest', 'run', 'tests/merge-verify/migration-ordering.test.ts'], { fatal: true }));

const phaseTests = [
  ['Phase 1-2 (Memory Core)', 'tests/merge-verify/phase-1-2-memory-core.test.ts'],
  ['Phase 3 (Storage)', 'tests/merge-verify/phase-3-storage.test.ts'],
  ['Phase 4 (Search)', 'tests/merge-verify/phase-4-search.test.ts'],
  ['Phase 5 (Capability)', 'tests/merge-verify/phase-5-capability.test.ts'],
  ['Phase 6 (Federation)', 'tests/merge-verify/phase-6-federation.test.ts'],
  ['Phase 7 (Audit Chain)', 'tests/merge-verify/phase-7-audit-chain.test.ts'],
  ['Phase 8 (Full Stack)', 'tests/merge-verify/phase-8-full-stack.test.ts'],
];
for (const [label, file] of phaseTests) {
  results.push(run(label, 'pnpm', ['vitest', 'run', file]));
}

results.push(run('Cross-phase seams', 'pnpm', ['vitest', 'run', 'tests/merge-verify/cross-phase-integration.test.ts']));
results.push(run('Settings bootstrap flat keys', 'pnpm', ['vitest', 'run', 'tests/merge-verify/settings-bootstrap-flat.test.ts']));

function finalize() {
  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
    },
  };
  writeFileSync('merge-verify-report.json', JSON.stringify(report, null, 2));
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  MERGE VERIFICATION SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════');
for (const r of results) {
  console.log(`  ${r.ok ? 'OK' : 'FAIL'} ${r.label}`);
}
finalize();
const failed = results.filter((r) => !r.ok);
console.log(`\n  ${results.length - failed.length}/${results.length} passed. Report: merge-verify-report.json`);
if (failed.length > 0) {
  console.log('\n  FAILED steps, fix these:');
  failed.forEach((r) => console.log(`     - ${r.label}`));
}
process.exit(failed.some((r) => r.fatal) ? 1 : (failed.length > 0 ? 1 : 0));
