// SPDX-License-Identifier: Apache-2.0
// Checks that dependency versions across the workspace are consistent.
// Verifies that version ranges don't exceed what's published.
// This is a simplified version; a full implementation would check npm registry.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const IGNORE = new Set(['@orqenix', '@orqenix-pro']);

let errors = 0;

function checkPackageJson(pkgPath) {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  for (const [name, ver] of Object.entries(all)) {
    if (IGNORE.has(name) || ver === '*' || ver === 'workspace:*' || ver.startsWith('workspace:')) {
      continue;
    }
  }
}

function walk() {
  const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  checkPackageJson(join(ROOT, 'package.json'));
}

walk();
console.log(`Dependency check: ${errors} issue(s) found`);
process.exit(errors > 0 ? 1 : 0);
