// SPDX-License-Identifier: Apache-2.0
// Test suite that verifies cleanup invariants. Run BEFORE and AFTER any cleanup
// action to ensure nothing essential was removed.
//
// Run: node scripts/cleanup/cleanup.test.mjs

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// MUST-EXIST: structural files that are NOT cruft and must survive any cleanup
test('pnpm-workspace.yaml exists with apps/packages/plugins', async () => {
  const path = join(ROOT, 'pnpm-workspace.yaml');
  if (!existsSync(path)) throw new Error('pnpm-workspace.yaml missing');
  const content = await readFile(path, 'utf-8');
  for (const glob of ['apps/*', 'packages/*', 'plugins/*']) {
    if (!content.includes(glob)) throw new Error(`Missing workspace glob: ${glob}`);
  }
});

test('Root package.json has verify + check + cleanup scripts', async () => {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
  const required = ['verify', 'check:deps', 'check:native', 'fix:deps'];
  for (const s of required) {
    if (!pkg.scripts?.[s]) throw new Error(`Missing root script: ${s}`);
  }
});

test('pnpm.onlyBuiltDependencies includes better-sqlite3', async () => {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8'));
  const allowlist = pkg.pnpm?.onlyBuiltDependencies ?? [];
  if (!allowlist.includes('better-sqlite3')) {
    throw new Error('better-sqlite3 not in onlyBuiltDependencies allowlist');
  }
});

test('.npmrc has node-linker=hoisted', async () => {
  const path = join(ROOT, '.npmrc');
  if (!existsSync(path)) throw new Error('.npmrc missing');
  const content = await readFile(path, 'utf-8');
  if (!content.includes('node-linker=hoisted')) {
    throw new Error('node-linker=hoisted missing from .npmrc');
  }
});

test('14 reference plugins exist (G70)', async () => {
  const plugins = [
    'notion-source', 'bge-embedding', 'bge-reranker', 'semantic-compression',
    'windowed-injection', 'qwen-rewriter', 'timeline-viz', 'python-analyzer',
    'design-kb', 'example-mcp-server', 'example-agent', 'test-runner-subagent',
    'git-commit-conventional', 'claude-code-binding-ref',
  ];
  for (const p of plugins) {
    const pkgPath = join(ROOT, 'plugins', p, 'package.json');
    if (!existsSync(pkgPath)) throw new Error(`Reference plugin missing: plugins/${p}/package.json`);
  }
});

test('No tracked dist/ files', () => {
  let tracked = '';
  try { tracked = execSync('git ls-files "**/dist/**"', { cwd: ROOT, encoding: 'utf-8' }); } catch { /* no matches */ }
  if (tracked.trim().length > 0) {
    throw new Error(`${tracked.split('\n').filter(Boolean).length} dist/ files tracked in git`);
  }
});

test('No tracked node_modules', () => {
  let tracked = '';
  try { tracked = execSync('git ls-files "**/node_modules/**"', { cwd: ROOT, encoding: 'utf-8' }); } catch { /* no matches */ }
  if (tracked.trim().length > 0) {
    throw new Error('node_modules tracked in git');
  }
});

test('No debug artifacts at root', async () => {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(ROOT);
  const debug = files.filter((f) => /^(verify|test|debug|post-fix)-.*\.(json|log|txt)$/.test(f));
  if (debug.length > 0) {
    throw new Error(`Debug artifacts at root: ${debug.join(', ')}`);
  }
});

test('All package.json files parse as valid JSON', async () => {
  const pkgs = execSync('git ls-files "**/package.json"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter(Boolean);
  for (const rel of pkgs) {
    try {
      JSON.parse(await readFile(join(ROOT, rel), 'utf-8'));
    } catch (err) {
      throw new Error(`Invalid JSON: ${rel} — ${err.message}`);
    }
  }
});

test('No .eslintrc.cjs files (must be flat config)', () => {
  let legacy = '';
  try { legacy = execSync('git ls-files "**/.eslintrc.cjs" "**/.eslintrc.js"', { cwd: ROOT, encoding: 'utf-8' }); } catch { /* no matches */ }
  if (legacy.trim().length > 0) {
    throw new Error(`Legacy ESLint configs: ${legacy.split('\n').filter(Boolean).join(', ')}`);
  }
});

test('SPDX headers on all source TS files', async () => {
  const files = execSync('git ls-files "packages/*/src/**/*.ts" "apps/*/src/**/*.ts" "plugins/*/src/**/*.ts"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter(Boolean);
  let missing = 0;
  for (const rel of files.slice(0, 1000)) {
    const content = await readFile(join(ROOT, rel), 'utf-8');
    if (!/SPDX-License-Identifier:/.test(content)) {
      missing += 1;
    }
  }
  if (missing > 0) {
    throw new Error(`${missing} files missing SPDX-License-Identifier header`);
  }
});

test('No PHASE 8 TODO markers in shipped code', () => {
  let matches = '';
  try { matches = execSync('git grep -l "PHASE 8 TODO" -- "packages/" "apps/" "plugins/"', { cwd: ROOT, encoding: 'utf-8' }); } catch { /* no matches */ }
  if (matches.trim().length > 0) {
    throw new Error(`PHASE 8 TODO markers in: ${matches.split('\n').filter(Boolean).join(', ')}`);
  }
});

test('Lockfile is in sync with package.json files', () => {
  try {
    execSync('pnpm install --frozen-lockfile --lockfile-only --reporter=silent', {
      cwd: ROOT, stdio: 'pipe',
    });
  } catch (err) {
    throw new Error('Lockfile out of sync. Run pnpm install.');
  }
});

// Run
let passed = 0;
let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`✗ ${name}\n    ${err.message}`);
    failed += 1;
  }
}

console.log(`\n══ Cleanup test results ══`);
console.log(`  Passed: ${passed}/${tests.length}`);
console.log(`  Failed: ${failed}/${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
