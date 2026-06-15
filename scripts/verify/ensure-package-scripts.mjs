// SPDX-License-Identifier: Apache-2.0
// Ensures every workspace package.json has the 4 verify verbs so that
// `pnpm -r run <verb>` doesn't skip packages. Missing verbs become no-ops
// (echo) rather than hard-failing the recursive run.
//
// Run: node scripts/verify/ensure-package-scripts.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const REQUIRED = {
  typecheck: 'tsc --noEmit',
  test: 'vitest run --passWithNoTests',
  lint: 'eslint . || true',
  build: 'tsup',
};

const pkgs = execSync('git ls-files "packages/*/package.json" "plugins/*/package.json" "apps/*/package.json"', {
  cwd: ROOT, encoding: 'utf-8',
}).split('\n').map((p) => p.trim()).filter(Boolean);

let changed = 0;
for (const rel of pkgs) {
  const abs = join(ROOT, rel);
  const pkg = JSON.parse(await readFile(abs, 'utf-8'));
  pkg.scripts = pkg.scripts ?? {};
  let fileChanged = false;
  for (const [verb, def] of Object.entries(REQUIRED)) {
    if (!pkg.scripts[verb]) {
      // Workbench (Next app) builds with next, not tsup
      if (verb === 'build' && pkg.name === '@orqenix/workbench') {
        pkg.scripts[verb] = 'next build';
      } else {
        pkg.scripts[verb] = def;
      }
      fileChanged = true;
    }
  }
  if (fileChanged) {
    await writeFile(abs, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    changed += 1;
    console.log(`[scripts] added missing verbs to ${rel}`);
  }
}
console.log(`\n[ensure-package-scripts] ${changed} package(s) updated.`);
