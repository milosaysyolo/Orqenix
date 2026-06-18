// SPDX-License-Identifier: Apache-2.0
// Test gate with scope filter. By default runs ONLY Phase 8 packages so legacy
// packages (e.g., @orqenix/core from Phase 4-6) do not block the Phase 8 release.
// Pass --all to include everything; --phase-8-only is the default.
//
// Run:
//   node scripts/verify/test-gate.mjs              # phase-8 only (default)
//   node scripts/verify/test-gate.mjs --all        # everything
//   node scripts/verify/test-gate.mjs --report     # write test-report.json

import { spawnSync, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const all = args.includes('--all');
const writeReport = args.includes('--report');

// Phase 8 packages (the 566-file scope). Anything NOT in this set is legacy.
const PHASE_8_PACKAGES = new Set([
  '@orqenix/ui-primitives',
  '@orqenix/plugin-core',
  '@orqenix/memory-engine',
  '@orqenix/settings-registry',
  '@orqenix/local-memory-federation',
  '@orqenix/skill-runtime',
  '@orqenix/binding-core',
  '@orqenix/mcp-server',
  '@orqenix/normalization-engine',
  '@orqenix/input-adapters',
  '@orqenix/output-adapters',
  '@orqenix/marketplace-core',
  '@orqenix/marketplace-ui',
  '@orqenix/migration-phase-7-to-8',
  '@orqenix/self-learning-observer',
  '@orqenix/self-learning-detection',
  '@orqenix/skill-genesis',
  '@orqenix/instinct-promoter',
  '@orqenix/verification-loop',
  '@orqenix/binding-claude-code',
  '@orqenix/binding-cursor',
  '@orqenix/binding-codex',
  '@orqenix/binding-opencode',
  '@orqenix/binding-cline',
  '@orqenix/binding-aider',
  '@orqenix/binding-continue',
  '@orqenix/workbench',
]);

// Reference plugins (also Phase 8 / G70)
function isRefPlugin(name) {
  return /^@orqenix\/plugin-/.test(name);
}

function listWorkspacePackages() {
  const out = execSync('pnpm -r list --depth -1 --json', { encoding: 'utf-8' });
  return JSON.parse(out)
    .map((p) => ({ name: p.name, path: p.path }))
    .filter((p) => p.name);
}

const pkgs = listWorkspacePackages();
const targets = pkgs.filter((p) => all || PHASE_8_PACKAGES.has(p.name) || isRefPlugin(p.name));
const excluded = pkgs.filter((p) => !targets.includes(p)).map((p) => p.name);

console.log(`Scope: ${all ? 'ALL' : 'PHASE 8 ONLY'}`);
console.log(`Running tests in ${targets.length} packages.`);
if (!all && excluded.length > 0) {
  console.log(`Skipping ${excluded.length} legacy/non-Phase-8 packages:`);
  excluded.forEach((n) => console.log('  - ' + n));
}
console.log('');

const results = [];
let totalPassed = 0;
let totalFailed = 0;

for (const pkg of targets) {
  const start = Date.now();
  const r = spawnSync('pnpm', ['--filter', pkg.name, 'run', 'test'], {
    stdio: 'pipe',
    encoding: 'utf-8',
    shell: process.platform === 'win32',
    timeout: 180000,
  });
  const durationMs = Date.now() - start;
  const ok = r.status === 0;

  // Parse vitest output for pass/fail counts
  const stdout = r.stdout ?? '';
  const passMatch = /Tests\s+\d*\s*failed[\s\S]*?(\d+)\s+passed/.exec(stdout) ?? /(\d+)\s+passed/.exec(stdout);
  const failMatch = /(\d+)\s+failed/.exec(stdout);
  const passed = passMatch ? Number(passMatch[1]) : 0;
  const failed = failMatch ? Number(failMatch[1]) : (ok ? 0 : 1);

  totalPassed += passed;
  totalFailed += failed;

  results.push({ name: pkg.name, ok, durationMs, passed, failed });
  console.log(`  ${ok ? '✅' : '❌'} ${pkg.name.padEnd(40)} ${passed}p ${failed}f (${(durationMs / 1000).toFixed(1)}s)`);
}

console.log(`\n══ TEST GATE SUMMARY ══`);
console.log(`  Packages tested:   ${targets.length}`);
console.log(`  Packages excluded: ${excluded.length}`);
console.log(`  Total tests passed: ${totalPassed}`);
console.log(`  Total tests failed: ${totalFailed}`);
console.log(`  Overall: ${totalFailed === 0 ? '✅ PASS' : '❌ FAIL'}`);

if (writeReport) {
  writeFileSync('test-report.json', JSON.stringify({
    scope: all ? 'all' : 'phase-8-only',
    timestamp: new Date().toISOString(),
    summary: { packages: targets.length, excluded: excluded.length, passed: totalPassed, failed: totalFailed },
    results,
    excluded,
  }, null, 2));
  console.log(`  Report: test-report.json`);
}

process.exit(totalFailed === 0 ? 0 : 1);
