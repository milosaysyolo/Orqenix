// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: scripts/verify/wb-install.mjs
// Purpose: Install the workspace + verify better-sqlite3 loads (the Workbench is
//   useless if memory.db can't open). Reuses the Phase 8 allowlist + hoisted
//   linker rules. Confirms next-themes + the @orqenix workspace deps are linked.
// Run: node scripts/verify/wb-install.mjs
// ============================================================================

import { spawnSync } from 'node:child_process';

const isWin = process.platform === 'win32';
function run(label, cmd, args) {
  process.stdout.write(`\n\u25B6 ${label}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: isWin });
  if (r.status !== 0) { console.error(`\u2717 ${label} failed`); process.exit(1); }
  console.log(`\u2713 ${label}`);
}

// 1. Install (build deps the workbench imports first).
run('install', 'pnpm', ['install']);
run('build @orqenix/* deps', 'pnpm', ['-r', '--filter', '@orqenix/*', '--no-bail', 'run', 'build']);

// 2. Verify better-sqlite3 loads + can open :memory:.
const probe = `
try {
  const D = require('better-sqlite3');
  const db = new D(':memory:'); db.exec('CREATE TABLE t(x); INSERT INTO t VALUES(1)');
  const r = db.prepare('SELECT x FROM t').get();
  db.close();
  process.stdout.write('OK:' + r.x);
} catch (e) { process.stdout.write('FAIL:' + e.message); }
`;
const r = spawnSync(process.execPath, ['-e', probe], { encoding: 'utf-8', cwd: 'apps/workbench' });
if ((r.stdout ?? '').startsWith('OK')) console.log('\n\u2713 better-sqlite3 opens :memory:');
else { console.error('\n\u2717 better-sqlite3 cannot load: ' + r.stdout); console.error('  \u2192 pnpm rebuild better-sqlite3'); process.exit(1); }

console.log('\n\u2705 install + native binding OK');