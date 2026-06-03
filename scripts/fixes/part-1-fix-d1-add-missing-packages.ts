#!/usr/bin/env tsx
// SPDX-License-Identifier: Apache-2.0
// @bc Phase5-Foundation-Fix-D1
// @gate G1

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const REPO_ROOT = resolve(__dirname, "../..");
const CANONICAL = join(REPO_ROOT, ".orqenix/phase-5-packages.yaml");

interface PackageEntry {
  name: string;
  path: string;
  tier: "oss" | "pro";
  implementedIn: string;
}

interface CanonicalManifest {
  schemaVersion: number;
  totalCount: number;
  packages: PackageEntry[];
}

function listExistingPackages(): Set<string> {
  const out = execSync("pnpm -r list --depth -1 --json", {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const arr = JSON.parse(out) as Array<{ name: string }>;
  return new Set(arr.map((p) => p.name));
}

function loadCanonical(): CanonicalManifest {
  return parseYaml(readFileSync(CANONICAL, "utf-8")) as unknown as CanonicalManifest;
}

function scaffold(pkg: PackageEntry): void {
  if (existsSync(join(REPO_ROOT, pkg.path, "package.json"))) {
    console.log(`  skip (exists): ${pkg.name}`);
    return;
  }
  const license = pkg.tier === "pro" ? "BSL-1.1" : "Apache-2.0";
  execSync(
    `pnpm tsx scripts/scaffold/create.ts --name "${pkg.name}" --path "${pkg.path}" --license "${license}" --todo "${pkg.implementedIn}"`,
    { cwd: REPO_ROOT, stdio: "inherit" },
  );
}

function main(): void {
  const canonical = loadCanonical();
  if (canonical.totalCount !== 46) {
    throw new Error(`canonical manifest must declare 46 packages, got ${canonical.totalCount}`);
  }
  const existing = listExistingPackages();
  const missing = canonical.packages.filter((p) => !existing.has(p.name));
  console.log(`Found ${existing.size} existing, ${missing.length} missing (target: 46)`);
  for (const pkg of missing) scaffold(pkg);
  execSync("pnpm install", { cwd: REPO_ROOT, stdio: "inherit" });
  execSync("pnpm -r --workspace-concurrency=1 exec tsc --build", {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  const after = listExistingPackages();
  if (after.size < 46) throw new Error(`expected 46 packages after fix, got ${after.size}`);
  console.log(`✓ D1 fix complete: ${after.size} packages`);
}

main();
