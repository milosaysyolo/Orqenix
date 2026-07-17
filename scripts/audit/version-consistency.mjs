#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * version-consistency.mjs — Check all packages share consistent version.
 * If versions differ, groups by version and exits 1 (expected to fail
 * until a consolidation pass aligns them).
 *
 * Usage: node scripts/audit/version-consistency.mjs
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, "packages");

// ---- helpers

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf-8"));
}

const SKIP_NAMES = new Set([
  "@orqenix/_meta",
  "@orqenix/testing",
  "@orqenix/bench",
]);

// ---- main

const versions = {}; // version -> [pkgName, ...]

const pkgDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const dir of pkgDirs) {
  const pkgJsonPath = join(PACKAGES_DIR, dir, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = readJson(pkgJsonPath);
  const pkgName = pkg.name || dir;

  // Skip intentionally-different-version meta packages
  if (SKIP_NAMES.has(pkgName)) continue;

  if (!pkg.version) continue;

  if (!versions[pkg.version]) versions[pkg.version] = [];
  versions[pkg.version].push(pkgName);
}

const versionList = Object.keys(versions).sort();

if (versionList.length === 0) {
  console.log("No packages with versions found.");
  process.exit(1);
}

console.log(`\nVersion-consistency audit: ${versionList.length} distinct version(s)\n`);

for (const ver of versionList) {
  const pkgs = versions[ver];
  console.log(`  ${ver}  (${pkgs.length} pkg${pkgs.length > 1 ? "s" : ""})`);
  for (const p of pkgs) {
    console.log(`    └─ ${p}`);
  }
}

if (versionList.length === 1) {
  console.log("\n✅ PASS: All packages share the same version.\n");
  process.exit(0);
} else {
  console.log(
    "\n⚠️  Versions differ. Consolidate with a version bump pass.",
  );
  console.log(
    "   (Packages like _meta and testing are excluded from this check.)\n",
  );
  process.exit(1);
}
