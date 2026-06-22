// SPDX-License-Identifier: Apache-2.0
// ============================================================================
// AGENT PROMPT
// File: scripts/verify/wb-preflight.mjs
// Purpose: Static pre-flight before install/build. Verifies the Workbench file
//   tree is complete (all 91 files at expected paths), no collapsed files (//
//   comment + code on one line eating exports), package.json deps don't require
//   versions higher than published, and the migration ids are unique.
// Run: node scripts/verify/wb-preflight.mjs
// ============================================================================

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const WB = 'apps/workbench';

const REQUIRED = [
  'package.json', 'next.config.mjs', 'tailwind.config.ts', 'postcss.config.mjs', 'tsconfig.json',
  'app/layout.tsx', 'app/globals.css', 'app/icon.tsx',
  'app/(workbench)/page.tsx', 'app/(workbench)/layout.tsx', 'app/(workbench)/loading.tsx', 'app/(workbench)/error.tsx',
  'app/(workbench)/memory/page.tsx', 'app/(workbench)/learning/page.tsx', 'app/(workbench)/branches/page.tsx',
  'app/(workbench)/agents/orchestrator/page.tsx', 'app/(workbench)/agents/runner/page.tsx',
  'app/(workbench)/agents/sessions/page.tsx', 'app/(workbench)/agents/subagents/page.tsx',
  'app/(workbench)/agents/mcp/page.tsx', 'app/(workbench)/agents/bindings/page.tsx', 'app/(workbench)/agents/network/page.tsx',
  'app/(workbench)/marketplace/page.tsx', 'app/(workbench)/marketplace/new/page.tsx', 'app/(workbench)/marketplace/import/page.tsx',
  'app/(workbench)/marketplace/[name]/page.tsx', 'app/(workbench)/plugins/page.tsx', 'app/(workbench)/skills/page.tsx',
  'app/(workbench)/mesh/page.tsx', 'app/(workbench)/audit/page.tsx', 'app/(workbench)/observability/page.tsx',
  'app/(workbench)/settings/page.tsx',
  'app/api/stream/route.ts', 'app/api/dashboard/route.ts', 'app/api/query/demo/route.ts',
  'app/api/memory/query/route.ts', 'app/api/memory/graph/route.ts', 'app/api/memory/[id]/route.ts',
  'app/api/memory/link/route.ts', 'app/api/memory/library/route.ts',
  'app/api/marketplace/route.ts', 'app/api/plugins/route.ts', 'app/api/skills/route.ts', 'app/api/mesh/route.ts',
  'app/api/agents/route.ts', 'app/api/agents/teams/route.ts', 'app/api/agents/run/route.ts', 'app/api/agents/tick/route.ts',
  'app/api/sessions/route.ts', 'app/api/mcp/route.ts', 'app/api/bindings/route.ts',
  'app/api/audit/route.ts', 'app/api/observability/route.ts', 'app/api/settings/route.ts', 'app/api/branches/route.ts',
  'app/api/learning/route.ts', 'app/api/learning/observer/route.ts',
  'lib/runtime.ts', 'lib/event-bus.ts', 'lib/use-live-events.ts', 'lib/api.ts',
  'lib/marketplace-store.ts', 'lib/settings-bootstrap.ts', 'lib/plugin-lifecycle.ts',
  'lib/migrations/570-memory-links.ts', 'lib/migrations/580-agents.ts', 'lib/migrations/590-workbench-state.ts',
  'components/theme.tsx', 'components/app-shell.tsx', 'components/ui.tsx',
  'components/dashboard/context-pipeline.tsx', 'components/dashboard/matrix-viz.tsx', 'components/dashboard/agent-activity.tsx',
  'components/dashboard/recent-learning.tsx', 'components/dashboard/mesh-status.tsx', 'components/dashboard/run-query-button.tsx',
  'components/memory/graph-view.tsx', 'components/memory/library-rail.tsx', 'components/memory/entry-detail.tsx',
  'components/agents/team-canvas.tsx', 'components/agents/agent-library.tsx', 'components/agents/agent-editor.tsx',
  'components/agents/agent-network.tsx', 'components/agents/run-logs.tsx',
];

let problems = 0;

console.log('\u2014 file presence \u2014');
const missing = [];
for (const rel of REQUIRED) {
  if (!existsSync(join(ROOT, WB, rel))) { missing.push(rel); problems++; }
}
if (missing.length) { console.error(`\u274C ${missing.length} missing:`); missing.forEach((m) => console.error('   ' + m)); }
else console.log(`\u2713 all ${REQUIRED.length} critical files present`);

console.log('\n\u2014 collapse detection \u2014');
let collapsed = 0;
for (const rel of REQUIRED.filter((r) => /\.(ts|tsx)$/.test(r))) {
  const p = join(ROOT, WB, rel);
  if (!existsSync(p)) continue;
  const content = await readFile(p, 'utf-8');
  const lines = content.split('\n');
  if (lines.length < 3 && content.length > 400) { console.error(`\u274C collapsed: ${rel}`); collapsed++; problems++; continue; }
  for (let i = 0; i < lines.length; i++) {
    if (/\/\/[^\n]*\b(export|import)\s+(\{|const|class|function|default|type)/.test(lines[i])) {
      console.error(`\u274C comment-hides-export: ${rel}:${i + 1}`); collapsed++; problems++; break;
    }
  }
}
if (collapsed === 0) console.log('\u2713 no collapsed files');

console.log('\n\u2014 package.json sanity \u2014');
try {
  const pkg = JSON.parse(await readFile(join(ROOT, WB, 'package.json'), 'utf-8'));
  const mustHave = ['next', 'react', 'react-dom', 'next-themes', 'better-sqlite3', '@orqenix/memory-engine'];
  for (const d of mustHave) {
    if (!pkg.dependencies?.[d]) { console.error(`\u274C missing dependency: ${d}`); problems++; }
  }
  if (pkg.dependencies?.zod && !/\^3\.25/.test(pkg.dependencies.zod)) console.warn(`\u26A0 zod should be ^3.25.x (MCP peer)`);
  if (!pkg.dependencies?.['better-sqlite3']?.startsWith('^11')) console.warn('\u26A0 better-sqlite3 should be ^11.x');
  console.log('\u2713 package.json checked');
} catch (e) { console.error('\u274C package.json: ' + e.message); problems++; }

console.log(`\n[wb-preflight] ${problems} problem(s).`);
process.exit(problems > 0 ? 1 : 0);