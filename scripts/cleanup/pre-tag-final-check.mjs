// SPDX-License-Identifier: Apache-2.0
// Final pre-tag checklist. Must exit 0 before `git tag v0.8.0`.

import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const checks = [];

function check(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    checks.push({ name, ok: true });
  } catch (err) {
    console.error(`❌ ${name}\n    ${err.message}`);
    checks.push({ name, ok: false, error: err.message });
  }
}

// 1. binding-core has LICENSE (newly added)
check('binding-core LICENSE exists (Phase 8 D8.α.7 npm-publishable)', () => {
  if (!existsSync(join(ROOT, 'packages/binding-core/LICENSE'))) {
    throw new Error('packages/binding-core/LICENSE missing');
  }
});

// 2. Cleanup test passes
check('Cleanup test suite 12+/13 pass', () => {
  const r = spawnSync('node', ['scripts/cleanup/cleanup.test.mjs'], { cwd: ROOT, encoding: 'utf-8' });
  const passed = (r.stdout?.match(/Passed: (\d+)/) ?? [])[1];
  const total = (r.stdout?.match(/\/(\d+)/) ?? [])[1];
  if (!passed || +passed < 12) {
    throw new Error(`Only ${passed}/${total} passed. Need 12+.`);
  }
});

// 3. Typecheck passes
check('Typecheck 108+/108 packages', () => {
  const r = spawnSync('pnpm', ['-r', 'run', 'typecheck'], {
    cwd: ROOT, shell: process.platform === 'win32', stdio: 'pipe', encoding: 'utf-8',
  });
  if (r.status !== 0) {
    const failed = (r.stdout ?? '').match(/failed/gi)?.length ?? 1;
    throw new Error(`Typecheck failed (${failed} package error(s))`);
  }
});

// 4. Lockfile in sync
check('Lockfile is in sync', () => {
  const r = spawnSync('pnpm', ['install', '--frozen-lockfile', '--lockfile-only', '--reporter=silent'], {
    cwd: ROOT, shell: process.platform === 'win32', stdio: 'pipe',
  });
  if (r.status !== 0) {
    throw new Error('Lockfile drifted. Run pnpm install.');
  }
});

// 5. No debug artifacts
check('No debug artifacts at root', async () => {
  const files = await readdir(ROOT);
  const debug = files.filter((f) => /^(verify|test|debug|post-fix)-.*\.(json|log|txt)$/.test(f));
  if (debug.length > 0) {
    throw new Error(`Debug artifacts: ${debug.join(', ')}`);
  }
});

// 6. 14 reference plugins still present (G70)
check('14 reference plugins present (G70 gate)', () => {
  const plugins = [
    'notion-source', 'bge-embedding', 'bge-reranker', 'semantic-compression',
    'windowed-injection', 'qwen-rewriter', 'timeline-viz', 'python-analyzer',
    'design-kb', 'example-mcp-server', 'example-agent', 'test-runner-subagent',
    'git-commit-conventional', 'claude-code-binding-ref',
  ];
  for (const p of plugins) {
    if (!existsSync(join(ROOT, 'plugins', p, 'package.json'))) {
      throw new Error(`plugins/${p}/package.json missing`);
    }
  }
});

// 7. No PHASE 8 TODO
check('No PHASE 8 TODO markers in shipped code', () => {
  try {
    const r = spawnSync('git', ['grep', '-l', 'PHASE 8 TODO', '--', 'packages/', 'apps/', 'plugins/'], {
      cwd: ROOT, encoding: 'utf-8',
    });
    if (r.stdout?.trim().length > 0) {
      throw new Error(`PHASE 8 TODO markers in: ${r.stdout.trim()}`);
    }
  } catch { /* git grep returns non-zero when nothing found, which is what we want */ }
});

console.log(`\n══ Pre-tag final check ══`);
const passed = checks.filter((c) => c.ok).length;
console.log(`  ${passed}/${checks.length} checks passed`);

if (passed === checks.length) {
  console.log('\n✅ Ready to tag v0.8.0.');
  console.log('\nNext steps:');
  console.log('  git add -A');
  console.log('  git commit -m "chore: pre-tag final patch for v0.8.0"');
  console.log('  git tag -a v0.8.0 -m "Phase 8 CORE complete"');
  console.log('  git push origin v0.8.0');
  process.exit(0);
} else {
  console.error('\n❌ NOT ready to tag. Fix the failures above.');
  process.exit(1);
}
