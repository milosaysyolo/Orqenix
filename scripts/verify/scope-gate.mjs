// SPDX-License-Identifier: Apache-2.0
// Defines the canonical Phase 8 scope. Refuses to let agent re-define scope
// to exclude failures. If a package is in Phase 8 scope, it MUST pass typecheck.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// THIS IS THE LOCKED LIST. Do not modify without CR amendment.
// Sources: Phase 8 D8.alpha/beta/gamma/delta delivery reports + checkpoint memory.
const PHASE_8_SCOPE = [
  // D8.alpha Foundation
  '@orqenix/workbench',                  // D8.alpha.1, G61
  '@orqenix/ui-primitives',              // D8.alpha.2, G61-07/08/09
  '@orqenix/local-memory-federation',    // D8.alpha.3, G58-09/10/11
  '@orqenix/plugin-core',                // D8.alpha.4, G62
  '@orqenix/settings-registry',          // D8.alpha.5, G64
  '@orqenix/memory-engine',              // D8.alpha.6, G58/G59/G60
  '@orqenix/mcp-server',                 // D8.alpha.7, G63
  '@orqenix/skill-runtime',              // D8.alpha.7
  '@orqenix/binding-core',               // D8.alpha.7
  '@orqenix/binding-adapters',           // D8.alpha.7 (merged: aider, claude-code, cline, codex, continue, cursor, opencode)
  // D8.beta Marketplace
  '@orqenix/marketplace-core',           // G65
  '@orqenix/marketplace-ui',
  '@orqenix/normalization-engine',       // G66
  '@orqenix/input-adapters',
  '@orqenix/output-adapters',
  // D8.gamma Self-Learning OSS
  '@orqenix/self-learning-observer',     // G67
  '@orqenix/self-learning-detection',
  '@orqenix/instinct-promoter',
  '@orqenix/skill-genesis',              // G68
  '@orqenix/verification-loop',
  // D8.delta Reference Plugins + Migration
  '@orqenix/migration-phase-7-to-8',     // G70
  // 14 reference plugins (G70-01/02)
  '@orqenix/plugin-notion-source',
  '@orqenix/plugin-bge-embedding',
  '@orqenix/plugin-bge-reranker',
  '@orqenix/plugin-semantic-compression',
  '@orqenix/plugin-windowed-injection',
  '@orqenix/plugin-qwen-rewriter',
  '@orqenix/plugin-timeline-viz',
  '@orqenix/plugin-python-analyzer',
  '@orqenix/plugin-design-kb',
  '@orqenix/plugin-example-mcp-server',
  '@orqenix/plugin-example-agent',
  '@orqenix/plugin-test-runner-subagent',
  '@orqenix/plugin-git-commit-conventional',
  '@orqenix/plugin-claude-code-binding-ref',
];

const PRO_SCOPE = [
  '@orqenix-pro/self-learning-advanced',  // G69 (advanced detection)
  '@orqenix-pro/cross-project-federation', // G69 (federation)
];

function workspacePackages() {
  const out = execSync('pnpm -r list --depth -1 --json', { encoding: 'utf-8' });
  return JSON.parse(out).map((p) => p.name).filter(Boolean);
}

const found = workspacePackages();
const inScope = PHASE_8_SCOPE.filter((p) => found.includes(p));
const missing = PHASE_8_SCOPE.filter((p) => !found.includes(p));
const extra = found.filter((p) => !PHASE_8_SCOPE.includes(p) && !p.includes('@orqenix-pro') && p.startsWith('@orqenix/'));

console.log('Phase 8 OSS Scope Verification:');
console.log(`  Declared:  ${PHASE_8_SCOPE.length}`);
console.log(`  Found:     ${inScope.length}`);
console.log(`  Missing:   ${missing.length}`);
console.log(`  Extra:     ${extra.length}`);

if (missing.length > 0) {
  console.error(`\n\u274C Packages declared in Phase 8 scope but NOT in workspace:`);
  missing.forEach((p) => console.error('  - ' + p));
  console.error(`\n   These MUST exist to claim Phase 8 CORE complete.`);
  process.exit(1);
}

if (extra.length > 0) {
  console.log(`\n\u26A0 Extra @orqenix packages found (not in Phase 8 scope):`);
  extra.forEach((p) => console.log('  - ' + p));
  console.log(`   These are legacy (pre-Phase-8) packages. They may be excluded from test gate.`);
}

console.log('\n\u2705 All Phase 8 packages are present in workspace.');
console.log('   To pass v0.8.0 gate, ALL of these must pass typecheck.');

console.log('\n--- SCOPE_JSON ---');
console.log(JSON.stringify({ phase8: inScope, pro: PRO_SCOPE, missing, extra }));
process.exit(0);
