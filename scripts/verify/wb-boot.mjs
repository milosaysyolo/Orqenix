// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: scripts/verify/wb-boot.mjs
// Purpose: Start the production server, hit every page route + key API routes,
//   assert no 500s, and assert /api/dashboard returns a real shape (matrix +
//   sessions + auditValid). Confirms the live wiring works end-to-end over HTTP.
// Run: node scripts/verify/wb-boot.mjs
// ============================================================================

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:27420';
const PAGES = [
  '/', '/memory', '/branches', '/learning',
  '/agents/orchestrator', '/agents/runner', '/agents/sessions', '/agents/subagents',
  '/agents/mcp', '/agents/bindings', '/agents/network',
  '/marketplace', '/plugins', '/skills', '/mesh', '/audit', '/observability', '/settings',
];
const APIS = ['/api/dashboard', '/api/memory/graph', '/api/sessions?state=all', '/api/mcp', '/api/bindings', '/api/audit', '/api/observability', '/api/settings'];

let server;
async function waitUp(ms = 60000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try { const r = await fetch(BASE, { signal: AbortSignal.timeout(2000) }); if (r.status < 500) return true; } catch {}
    await sleep(1000);
  }
  return false;
}

async function main() {
  process.env.ORQENIX_DEV = '1';
  console.log('Starting workbench (production)\u2026');
  server = spawn('pnpm', ['--filter', '@orqenix/workbench', 'run', 'start'], { shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let stderr = '';
  server.stderr.on('data', (d) => { stderr += d.toString(); });

  if (!(await waitUp())) { console.error('\u2717 server did not start\n' + stderr.slice(-1500)); cleanup(1); }
  console.log('\u2713 server up\n');

  let failed = 0;
  console.log('\u2014 page routes \u2014');
  for (const p of PAGES) {
    try { const r = await fetch(BASE + p, { signal: AbortSignal.timeout(10000) }); const ok = r.status < 500; console.log(`  ${ok ? '\u2705' : '\u274C'} ${p} ${r.status}`); if (!ok) failed++; }
    catch (e) { console.log(`  \u274C ${p} ${e.message}`); failed++; }
  }

  console.log('\n\u2014 api routes \u2014');
  for (const a of APIS) {
    try { const r = await fetch(BASE + a, { signal: AbortSignal.timeout(10000) }); const ok = r.status < 500; console.log(`  ${ok ? '\u2705' : '\u274C'} ${a} ${r.status}`); if (!ok) failed++; }
    catch (e) { console.log(`  \u274C ${a} ${e.message}`); failed++; }
  }

  console.log('\n\u2014 real data shape \u2014');
  try {
    const r = await fetch(BASE + '/api/dashboard'); const j = await r.json();
    const ok = j && typeof j.matrix === 'object' && typeof j.sessions === 'object' && 'auditValid' in j;
    console.log(`  ${ok ? '\u2705' : '\u274C'} /api/dashboard returns matrix+sessions+auditValid`);
    if (!ok) failed++;
  } catch (e) { console.log('  \u274C /api/dashboard shape: ' + e.message); failed++; }

  if (/Error:|Cannot find module|ECONNREFUSED/.test(stderr)) { console.error('\n\u274C server errors:\n' + stderr.slice(-1200)); failed++; }

  console.log(`\n${failed === 0 ? '\u2705 Workbench boots + serves real data' : `\u274C ${failed} check(s) failed`}`);
  cleanup(failed > 0 ? 1 : 0);
}

function cleanup(code) { try { server?.kill('SIGKILL'); } catch {} process.exit(code); }
process.on('SIGINT', () => cleanup(130));
main().catch((e) => { console.error(e); cleanup(1); });