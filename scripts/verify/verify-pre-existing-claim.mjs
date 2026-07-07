// SPDX-License-Identifier: Apache-2.0
// Forces every "pre-existing" claim to be backed by git blame evidence.
// Compares the current branch's failures against the main branch baseline.
// If a failure exists on main -> genuinely pre-existing.
// If NOT on main -> it's a Phase 8 regression, NOT pre-existing.
//
// Run: node scripts/verify/verify-pre-existing-claim.mjs <failure-file>

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const claims = [
  { file: "apps/workbench/package.json", expectedField: "dependencies.next-themes" },
  {
    file: "packages/ui-primitives/package.json",
    expectedField: "devDependencies.tailwindcss-animate",
  },
];

console.log('Verifying "pre-existing" claims against main branch...\n');

let violations = 0;

for (const claim of claims) {
  try {
    const mainContent = execSync(`git show main:${claim.file} 2>/dev/null`, { encoding: "utf-8" });
    const main = JSON.parse(mainContent);
    const currentContent = existsSync(claim.file) ? readFileSync(claim.file, "utf-8") : null;

    if (!currentContent) {
      console.log(`\u23ED  ${claim.file} not on current branch`);
      continue;
    }
    const current = JSON.parse(currentContent);

    const [section, depName] = claim.expectedField.split(".");
    const mainHas = main[section]?.[depName] !== undefined;
    const currentHas = current[section]?.[depName] !== undefined;

    if (!mainHas && !currentHas) {
      console.log(`\u26A0 ${claim.file}: ${claim.expectedField} missing on BOTH main and current.`);
      console.log(`   This means the dep was NEVER added, even though it's claimed needed.`);
      console.log(`   Likely actual cause: spec gap that must be fixed now.`);
      violations += 1;
    } else if (mainHas && !currentHas) {
      console.log(
        `\u274C ${claim.file}: ${claim.expectedField} REMOVED in current branch (regression)`,
      );
      violations += 1;
    } else if (!mainHas && currentHas) {
      console.log(
        `\u2713 ${claim.file}: ${claim.expectedField} ADDED in current branch (intentional)`,
      );
    } else {
      console.log(`\u2713 ${claim.file}: ${claim.expectedField} present on both branches`);
    }
  } catch (err) {
    console.log(`\u26A0 Could not compare ${claim.file}: ${err.message}`);
  }
}

if (violations > 0) {
  console.error(`\n\u274C ${violations} pre-existing claim(s) FAILED verification.`);
  console.error(`   "Pre-existing" requires the same failure on main branch.`);
  console.error(`   Spec gaps must be fixed, not classified as pre-existing.`);
  process.exit(1);
}

console.log("\n\u2705 All pre-existing claims have git blame evidence.");
process.exit(0);
