// SPDX-License-Identifier: Apache-2.0
// Verifies the stubs D8.α.3/α.4/α.5 declared are ACTUALLY wired by D8.α.6 +
// D8.β + D8.γ, not left as placeholders that silently return empty.
//
// This catches the #1 integration risk: a "// D8.α.6 wires this" comment that
// was never replaced with real code.
//
// Run: node scripts/verify/check-stub-wiring.mjs

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// Each entry: a file that MUST contain a real implementation marker (regex),
// and MUST NOT still be a placeholder-only stub.
const CHECKS = [
  {
    file: 'apps/workbench/lib/marketplace-store.ts',
    mustContain: /SqliteLocalPluginStore/,
    mustNotBeStubOnly: /D8\.α\.6 wires|TODO: wire/i,
    note: 'Marketplace LocalPluginStore wired to SQLite',
  },
  {
    file: 'apps/workbench/lib/self-learning-provider.ts',
    mustContain: /buildSelfLearning/,
    note: 'Self-learning stack wired to memory-engine db',
  },
  {
    file: 'apps/workbench/lib/self-learning-migrations.ts',
    mustContain: /applySelfLearningMigrations|SELF_LEARNING_MIGRATIONS/,
    note: 'Self-learning migrations composed at Workbench layer',
  },
  {
    file: 'packages/memory-engine/src/migrations/550-marketplace.ts',
    mustContain: /installed_plugins|marketplace_imports|config_overrides/,
    note: 'Memory-engine migrations include marketplace + plugin + settings tables',
  },
];

// API routes are allowed to remain thin (note-only) in D8.α since runtime
// wiring is a Workbench-bootstrap concern. We WARN, not fail, for those.
const API_ROUTE_WARN = [
  'apps/workbench/app/api/marketplace/route.ts',
  'apps/workbench/app/api/learning/candidates/route.ts',
  'apps/workbench/app/api/learning/genesis/route.ts',
  'apps/workbench/app/api/learning/verify/route.ts',
  'apps/workbench/app/api/plugins/route.ts',
];

let failures = 0;
let warnings = 0;

for (const check of CHECKS) {
  const abs = join(ROOT, check.file);
  if (!existsSync(abs)) {
    console.error(`❌ MISSING: ${check.file} (${check.note})`);
    failures += 1;
    continue;
  }
  const content = await readFile(abs, 'utf-8');
  if (check.mustContain && !check.mustContain.test(content)) {
    console.error(`❌ NOT WIRED: ${check.file} missing ${check.mustContain} (${check.note})`);
    failures += 1;
    continue;
  }
  if (check.mustNotBeStubOnly && check.mustNotBeStubOnly.test(content) && content.length < 600) {
    console.error(`❌ STILL A STUB: ${check.file} (${check.note})`);
    failures += 1;
    continue;
  }
  console.log(`✓ ${check.file}: ${check.note}`);
}

for (const route of API_ROUTE_WARN) {
  const abs = join(ROOT, route);
  if (!existsSync(abs)) continue;
  const content = await readFile(abs, 'utf-8');
  if (/wires at runtime|D8\.α\.6 wires|note:/i.test(content)) {
    console.warn(`⚠ API route still thin (runtime-wired at Workbench bootstrap): ${route}`);
    warnings += 1;
  }
}

console.log(`\n[stub-wiring] ${failures} failure(s), ${warnings} warning(s).`);
process.exit(failures > 0 ? 1 : 0);
