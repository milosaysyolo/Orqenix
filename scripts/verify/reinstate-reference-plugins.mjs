import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const REFERENCE_PLUGINS = [
  { name: '@orqenix/plugin-notion-source', dir: 'plugins/notion-source', kind: 'knowledge-source', deliveryRef: 'D8.δ Part 1 File 1-4' },
  { name: '@orqenix/plugin-bge-embedding', dir: 'plugins/bge-embedding', kind: 'embedding-model', deliveryRef: 'D8.δ Part 1 File 5-8' },
  { name: '@orqenix/plugin-bge-reranker', dir: 'plugins/bge-reranker', kind: 'reranker', deliveryRef: 'D8.δ Part 1 File 9-12' },
  { name: '@orqenix/plugin-semantic-compression', dir: 'plugins/semantic-compression', kind: 'compression-strategy', deliveryRef: 'D8.δ Part 1 File 13-16' },
  { name: '@orqenix/plugin-windowed-injection', dir: 'plugins/windowed-injection', kind: 'memory-injection-strategy', deliveryRef: 'D8.δ Part 1 File 17-20' },
  { name: '@orqenix/plugin-qwen-rewriter', dir: 'plugins/qwen-rewriter', kind: 'prompt-rewriter', deliveryRef: 'D8.δ Part 1 File 21-24' },
  { name: '@orqenix/plugin-timeline-viz', dir: 'plugins/timeline-viz', kind: 'visualization', deliveryRef: 'D8.δ Part 1 File 25-28' },
  { name: '@orqenix/plugin-python-analyzer', dir: 'plugins/python-analyzer', kind: 'code-analyzer', deliveryRef: 'D8.δ Part 1 File 29-32' },
  { name: '@orqenix/plugin-design-kb', dir: 'plugins/design-kb', kind: 'kb-schema', deliveryRef: 'D8.δ Part 1 File 33-36' },
  { name: '@orqenix/plugin-example-mcp-server', dir: 'plugins/example-mcp-server', kind: 'mcp-server', deliveryRef: 'D8.δ Part 2 File 37-40' },
  { name: '@orqenix/plugin-example-agent', dir: 'plugins/example-agent', kind: 'agent', deliveryRef: 'D8.δ Part 2 File 41-44' },
  { name: '@orqenix/plugin-test-runner-subagent', dir: 'plugins/test-runner-subagent', kind: 'subagent', deliveryRef: 'D8.δ Part 2 File 45-48' },
  { name: '@orqenix/plugin-git-commit-conventional', dir: 'plugins/git-commit-conventional', kind: 'skill', deliveryRef: 'D8.δ Part 2 File 49-52' },
  { name: '@orqenix/plugin-claude-code-binding-ref', dir: 'plugins/claude-code-binding-ref', kind: 'agent-binding', deliveryRef: 'D8.δ Part 2 File 53-56' },
];

console.log('Reference Plugin Inventory (G70 Charter Gate)\n');
console.log('  Required by Phase 8 D8.δ G70-01 + G70-02: 14 plugins');
console.log(`  Sub-criteria: G70-03 (all pass conformance)\n`);

const missing = [];
const present = [];

for (const plugin of REFERENCE_PLUGINS) {
  const dir = join(ROOT, plugin.dir);
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) {
    missing.push(plugin);
    console.log(`  ❌ ${plugin.name} (kind: ${plugin.kind})`);
    console.log(`     → ${plugin.dir}/ MISSING. See ${plugin.deliveryRef}`);
    continue;
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (pkg.orqenixPlugin?.kind !== plugin.kind) {
      console.log(`  ⚠ ${plugin.name} kind mismatch: pkg says "${pkg.orqenixPlugin?.kind}", expected "${plugin.kind}"`);
    } else {
      console.log(`  ✅ ${plugin.name} (kind: ${plugin.kind})`);
      present.push(plugin);
    }
  } catch (err) {
    console.log(`  ⚠ ${plugin.name}: invalid package.json (${err.message})`);
    missing.push(plugin);
  }
}

console.log(`\n══ Summary ══`);
console.log(`  Present: ${present.length}/14`);
console.log(`  Missing: ${missing.length}/14`);

if (missing.length > 0) {
  console.error(`\n❌ ${missing.length} reference plugin(s) missing.`);
  console.error(`   These are NOT "stretch" or "deferred" — they are G70 charter gate requirements.`);
  console.error(`   Phase 8 CORE cannot be complete without them.`);
  console.error(`\n   To restore: re-ship D8.δ Parts 1+2 from the original specs.`);
  console.error(`   Each plugin = 4 files (package.json + LICENSE + src/index.ts + tests/plugin.test.ts).`);
  console.error(`   Update pnpm-workspace.yaml to include "plugins/*".`);
  process.exit(1);
}

console.log(`\n✅ All 14 reference plugins present.`);
console.log(`   Run conformance verification next:`);
console.log(`     pnpm --filter "@orqenix/plugin-*" -r run test`);
process.exit(0);
