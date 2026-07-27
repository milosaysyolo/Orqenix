// SPDX-License-Identifier: Apache-2.0
// Fails if any package still ships .eslintrc.cjs / .eslintrc.* (legacy).
// ESLint 9 requires flat config. Run after migrate-eslint-flat-config.mjs.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const legacyFiles = execSync(
  'git ls-files "**/.eslintrc.cjs" "**/.eslintrc.js" "**/.eslintrc.json" "**/.eslintrc"',
  { cwd: ROOT, encoding: "utf-8" },
)
  .split("\n")
  .map((p) => p.trim())
  .filter(Boolean);

if (legacyFiles.length > 0) {
  console.error("Legacy ESLint config files found (ESLint 9 requires flat config):");
  legacyFiles.forEach((f) => console.error("  - " + f));
  console.error("\nRun: node scripts/verify/migrate-eslint-flat-config.mjs");
  process.exit(1);
}
console.log("All ESLint configs are flat config (ESLint 9 compatible).");
process.exit(0);
