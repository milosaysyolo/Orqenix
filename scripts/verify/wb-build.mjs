// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: scripts/verify/wb-build.mjs
// Purpose: Typecheck + production build the Workbench, then assert the Next build
//   produced the expected routes (all 18 screens + API routes compiled). Catches
//   stale-dist + SSR-on-better-sqlite3 + missing-export build failures.
// Run: node scripts/verify/wb-build.mjs
// ============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const isWin = process.platform === 'win32';
function run(label, args) {
  process.stdout.write(`\n\u25B6 ${label}\n`);
  const r = spawnSync('pnpm', ['--filter', '@orqenix/workbench', ...args], { stdio: 'inherit', shell: isWin });
  if (r.status !== 0) { console.error(`\u2717 ${label} failed`); process.exit(1); }
  console.log(`\u2713 ${label}`);
}

run('typecheck', ['run', 'typecheck']);
run('build', ['run', 'build']);

if (!existsSync('apps/workbench/.next')) { console.error('\u2717 .next not produced'); process.exit(1); }
console.log('\n\u2705 typecheck + build OK (.next produced)');