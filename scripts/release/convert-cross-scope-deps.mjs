#!/usr/bin/env node
/**
 * Converts cross-scope file: dependencies to npm version specs.
 * Reads each OSS package.json, replaces "@orqenix-pro/*": "file:../../Orqenix-Pro/..."
 * with the npm-published version from the latest Pro release tag.
 *
 * Safe to run multiple times; no-op if no file: deps present.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const REFS_PATH = resolve(ROOT, ".orqenix/cross-repo-refs.json");

if (!existsSync(REFS_PATH)) {
  console.warn("[convert-cross-scope-deps] cross-repo-refs.json not found; skipping.");
  process.exit(0);
}

const refs = JSON.parse(readFileSync(REFS_PATH, "utf8"));
const proRef = refs["orqenix-pro"]?.ref;

if (!proRef) {
  console.warn("[convert-cross-scope-deps] no orqenix-pro.ref; skipping.");
  process.exit(0);
}

// Extract version from Pro ref (v0.5.0-phase-5 → 0.5.0-phase-5)
const proVersion = proRef.replace(/^v/, "");

// Find all package.json files in packages/
let pkgFiles = [];
try {
  pkgFiles = execSync("find packages -name package.json -not -path '*/node_modules/*'", {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
} catch {
  console.warn("[convert-cross-scope-deps] no packages/ directory; skipping.");
  process.exit(0);
}

let converted = 0;
for (const file of pkgFiles) {
  const fullPath = resolve(ROOT, file);
  const pkg = JSON.parse(readFileSync(fullPath, "utf8"));
  let changed = false;

  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[section];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (
        name.startsWith("@orqenix-pro/") &&
        typeof spec === "string" &&
        spec.startsWith("file:")
      ) {
        deps[name] = `^${proVersion}`;
        changed = true;
      }
    }
  }

  if (changed) {
    writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + "\n");
    converted++;
    console.log(`Converted ${file}`);
  }
}

console.log(`[convert-cross-scope-deps] ${converted} package.json files updated.`);
process.exit(0);
