#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * dead-deps.mjs — Check all packages for declared workspace deps with zero
 * import/require usage in src/ (and optionally tests/). Exits 0 if clean.
 *
 * Usage: node scripts/audit/dead-deps.mjs
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const PACKAGES_DIR = join(ROOT, "packages");

// ---- helpers

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf-8"));
}

function readdirSafe(p) {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

function fileEntries(dir, recurse = true) {
  const entries = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && recurse && entry.name !== "node_modules") {
        entries.push(...fileEntries(full, recurse));
      } else if (entry.isFile()) {
        entries.push(full);
      }
    }
  } catch { /* skip unreadable */ }
  return entries;
}

/**
 * Check whether `depName` (e.g. "@orqenix/storage-sqlite") is imported
 * somewhere under `searchDirs`. Looks for:
 *   import … from "depName"
 *   require("depName")
 *   require("depName/subpath")
 *   import("depName")
 *   export … from "depName"
 */
function hasImport(depName, searchDirs) {
  const quoted = depName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match any import/require/re-export referencing the dep name
  // This covers:
  //   import { x } from "@orqenix/foo"
  //   import "@orqenix/foo"
  //   export { x } from "@orqenix/foo"
  //   require("@orqenix/foo")
  //   require("@orqenix/foo/something")
  const re = new RegExp(
    `(?:from|require)\\s*\\(?\\s*["'\`]${quoted}(?:/|["'\`])`,
  );

  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    for (const file of fileEntries(dir)) {
      if (
        !file.endsWith(".ts") &&
        !file.endsWith(".tsx") &&
        !file.endsWith(".mjs") &&
        !file.endsWith(".js") &&
        !file.endsWith(".cjs")
      ) continue;
      try {
        const content = readFileSync(file, "utf-8");
        if (re.test(content)) return true;
      } catch { /* skip */ }
    }
  }
  return false;
}

// ---- main

const allDead = {}; // pkgName -> [depName, ...]

const pkgDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const dir of pkgDirs) {
  const pkgJsonPath = join(PACKAGES_DIR, dir, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = readJson(pkgJsonPath);
  const pkgName = pkg.name || dir;

  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  const workspaceDeps = Object.keys(deps).filter(
    (n) => n.startsWith("@orqenix/") || n.startsWith("@orqenix-pro/"),
  );
  if (workspaceDeps.length === 0) continue;

  // Determine search locations
  const srcDir = join(PACKAGES_DIR, dir, "src");
  const testDirs = [];
  for (const td of ["tests", "__tests__", "test"]) {
    const p = join(PACKAGES_DIR, dir, td);
    if (existsSync(p)) testDirs.push(p);
  }
  const scriptsDir = join(PACKAGES_DIR, dir, "scripts");

  // If no src/ dir at all, skip — package may be build-only/config
  if (!existsSync(srcDir)) continue;

  for (const dep of workspaceDeps) {
    const inSrc = hasImport(dep, [srcDir]);
    const inTests = testDirs.length > 0 ? hasImport(dep, testDirs) : false;
    const inScripts = existsSync(scriptsDir) ? hasImport(dep, [scriptsDir]) : false;

    if (!inSrc && !inTests && !inScripts) {
      if (!allDead[pkgName]) allDead[pkgName] = [];
      allDead[pkgName].push(dep);
    }
  }
}

// ---- summary

const totalChecked = pkgDirs.length;
const totalDead = Object.values(allDead).flat().length;

console.log(`\nDead-deps audit: checked ${totalChecked} packages`);
console.log(`Total dead deps found: ${totalDead}\n`);

if (totalDead > 0) {
  for (const [pkg, deps] of Object.entries(allDead).sort()) {
    console.log(`  ${pkg}`);
    for (const dep of deps) {
      console.log(`    └─ ${dep}`);
    }
  }
  console.log("\n❌ FAIL: Remove or use the dead dependencies above.\n");
  process.exit(1);
} else {
  console.log("✅ PASS: No dead workspace dependencies.\n");
  process.exit(0);
}
