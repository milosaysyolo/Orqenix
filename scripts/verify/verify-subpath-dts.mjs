// SPDX-License-Identifier: Apache-2.0
// Verifies that every package exporting a subpath also ships the matching
// .d.ts file. Catches the instinct-promoter/ui class of bug (Workbench
// typecheck fails because subpath types are missing).
//
// Run AFTER build: node scripts/verify/verify-subpath-dts.mjs

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const pkgs = execSync('git ls-files "packages/*/package.json" "apps/*/package.json"', {
  cwd: ROOT, encoding: 'utf-8',
}).split('\n').map((p) => p.trim()).filter(Boolean);

let problems = 0;

for (const rel of pkgs) {
  const pkg = JSON.parse(await readFile(join(ROOT, rel), 'utf-8'));
  const pkgDir = dirname(join(ROOT, rel));
  const exportsMap = pkg.exports;
  if (!exportsMap || typeof exportsMap !== 'object') continue;

  for (const [subpath, cond] of Object.entries(exportsMap)) {
    if (subpath === './package.json') continue;
    if (typeof cond !== 'object' || cond === null) continue;

    const typesFile = cond.types;
    if (typesFile) {
      const abs = join(pkgDir, typesFile);
      if (!existsSync(abs)) {
        console.error(`❌ ${pkg.name} ${subpath}: declares types "${typesFile}" but file missing after build`);
        console.error(`   → Check tsup.config.ts emits dts for this entry, then rebuild.`);
        problems += 1;
      } else {
        console.log(`✓ ${pkg.name} ${subpath} → ${typesFile}`);
      }
    }
  }
}

if (problems > 0) {
  console.error(`\n❌ ${problems} subpath(s) missing .d.ts. These break consumer typecheck.`);
  console.error(`   This is the @orqenix/instinct-promoter/ui class of bug.`);
  process.exit(1);
}
console.log('\n✅ All subpath exports have matching .d.ts files.');
process.exit(0);
