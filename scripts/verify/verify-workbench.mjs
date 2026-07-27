// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: scripts/verify/verify-workbench.mjs
// Purpose: Run the full Workbench verification in order: preflight \u2192 install \u2192
//   migrations test \u2192 runtime/api test \u2192 build \u2192 boot HTTP smoke. Writes
//   wb-verify-report.json. This is the single command the agent runs.
// Run: node scripts/verify/verify-workbench.mjs   (or pnpm wb:verify)
// ============================================================================

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const steps = [];
function step(label, cmd, args, fatal = true) {
  process.stdout.write(`\n${'\u2550'.repeat(70)}\n  ${label}\n${'\u2550'.repeat(70)}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  const ok = r.status === 0;
  steps.push({ label, ok, fatal });
  if (!ok && fatal) { console.error(`\n\u274C ${label} failed (fatal). Stopping.`); finalize(); process.exit(1); }
  return ok;
}

step('1 preflight', 'node', ['scripts/verify/wb-preflight.mjs']);
step('2 install + native', 'node', ['scripts/verify/wb-install.mjs']);
step('3 migrations test', 'pnpm', ['--filter', '@orqenix/workbench', 'vitest', 'run', 'tests/migrations.test.ts']);
step('4 runtime+api test', 'pnpm', ['--filter', '@orqenix/workbench', 'vitest', 'run', 'tests/runtime-api.test.ts']);
step('5 build', 'node', ['scripts/verify/wb-build.mjs']);
step('6 boot HTTP smoke', 'node', ['scripts/verify/wb-boot.mjs'], false);

function finalize() {
  writeFileSync('wb-verify-report.json', JSON.stringify({ ts: new Date().toISOString(), steps }, null, 2));
}

process.stdout.write(`\n${'\u2550'.repeat(70)}\n  WORKBENCH VERIFY SUMMARY\n${'\u2550'.repeat(70)}\n`);
for (const s of steps) console.log(`  ${s.ok ? '\u2705' : '\u274C'} ${s.label}`);
finalize();
const failed = steps.filter((s) => !s.ok);
console.log(`\n  ${steps.length - failed.length}/${steps.length} passed \u00B7 report: wb-verify-report.json`);
process.exit(failed.some((s) => s.fatal) ? 1 : 0);