// SPDX-License-Identifier: Apache-2.0
// Applies the 2 reviewed dependency fixes across all package.json files.
// Per review: zod floor must match @modelcontextprotocol/sdk peer (>=3.25),
// and MCP SDK should pin to the tested minor (^1.25.0).
//
// Run: node scripts/verify/fix-dep-versions.mjs
// Idempotent: safe to run multiple times.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

/** Exact replacements applied to dependencies/devDependencies/peerDependencies */
const FIXES = {
  zod: { from: /^\^3\.23\.\d+$/, to: '^3.25.0', reason: 'match MCP SDK Zod peer floor (>=3.25)' },
  '@modelcontextprotocol/sdk': { from: /^\^1\.0\.0$/, to: '^1.25.0', reason: 'pin to tested minor' },
};

function findPackageJsons() {
  // Use git to enumerate tracked package.json files (fast, no node_modules)
  const out = execSync('git ls-files "**/package.json" "package.json"', {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  return out
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.includes('node_modules'));
}

let totalChanges = 0;
const changedFiles = [];

for (const rel of findPackageJsons()) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) continue;
  let raw;
  try {
    raw = await readFile(abs, 'utf-8');
  } catch {
    continue;
  }
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    console.warn(`[skip] invalid JSON: ${rel}`);
    continue;
  }

  let fileChanged = false;
  for (const block of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[block];
    if (!deps) continue;
    for (const [name, fix] of Object.entries(FIXES)) {
      if (deps[name] && fix.from.test(deps[name])) {
        const before = deps[name];
        deps[name] = fix.to;
        fileChanged = true;
        totalChanges += 1;
        console.log(`[fix] ${rel}: ${name} ${before} → ${fix.to} (${fix.reason})`);
      }
    }
  }

  if (fileChanged) {
    // Preserve 2-space indent + trailing newline (npm/pnpm convention)
    await writeFile(abs, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    changedFiles.push(rel);
  }
}

console.log(`\n[fix-dep-versions] ${totalChanges} change(s) across ${changedFiles.length} file(s).`);
if (changedFiles.length > 0) {
  console.log('Changed files:\n  - ' + changedFiles.join('\n  - '));
  console.log('\nNext: run `pnpm install` to refresh the lockfile.');
}
process.exit(0);
