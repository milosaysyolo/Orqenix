#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * bump-version.mjs — Bump all @orqenix/* packages under packages/ to v0.9.0.
 *
 * Usage:
 *   node scripts/release/bump-version.mjs          # apply changes
 *   node scripts/release/bump-version.mjs --dry-run # preview only
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const PACKAGES_DIR = join(ROOT, "packages");
const TARGET_VERSION = "0.9.0";

const isDryRun = process.argv.includes("--dry-run");

const SKIP_NAMES = new Set(["@orqenix/_meta", "@orqenix/testing", "@orqenix/bench"]);

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf-8"));
}

function writeJson(p, data) {
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

const WS_SCOPE_PREFIXES = ["@orqenix/", "@orqenix-pro/"];

/** True if a dep name is a workspace-scoped package (e.g. @orqenix/core) */
function isWsScope(name) {
  return WS_SCOPE_PREFIXES.some((p) => name.startsWith(p));
}

const pkgDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let changed = 0;

for (const dir of pkgDirs) {
  const pkgJsonPath = join(PACKAGES_DIR, dir, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const original = readFileSync(pkgJsonPath, "utf-8");
  const pkg = JSON.parse(original);
  const pkgName = pkg.name || dir;

  // Skip meta/testing/bench (intentionally different version schemes)
  if (SKIP_NAMES.has(pkgName)) {
    console.log(`  SKIP  ${pkgName} (excluded)`);
    continue;
  }

  let modified = false;

  // ---- Step a: bump version field
  if (pkg.version && pkg.version !== TARGET_VERSION) {
    pkg.version = TARGET_VERSION;
    modified = true;
  }

  // ---- Step b: update workspace-scope dependency ranges
  for (const depKey of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[depKey];
    if (!deps) continue;

    for (const depName of Object.keys(deps)) {
      if (isWsScope(depName) && deps[depName] !== "workspace:*") {
        deps[depName] = "workspace:*";
        modified = true;
      }
    }
  }

  if (modified) {
    const output = JSON.stringify(pkg, null, 2) + "\n";
    if (isDryRun) {
      console.log(`  WOULD  ${pkgName} (${dir}/package.json)`);
    } else {
      writeFileSync(pkgJsonPath, output);
      console.log(`  UPDATE ${pkgName} (${dir}/package.json)`);
    }
    changed++;
  } else {
    console.log(`  OK     ${pkgName} (already at ${TARGET_VERSION}, no dep changes)`);
  }
}

console.log(
  `\n${isDryRun ? "WOULD UPDATE" : "UPDATED"} ${changed} package(s) to v${TARGET_VERSION}.`,
);

if (isDryRun) {
  console.log("Pass --dry-run to preview. Omit it to apply.");
} else {
  console.log("Done. Run `pnpm install --no-frozen-lockfile` to update lockfile.");
}
