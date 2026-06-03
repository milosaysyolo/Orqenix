#!/usr/bin/env tsx
// SPDX-License-Identifier: Apache-2.0
// @bc Phase5-Foundation-Fix-D4
// @gate G1.2, G1.4

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = resolve(__dirname, "../..");

const PHASE_4_PACKAGES_WITH_DRIFT = [
  "packages/plugin-compress-input",
  "packages/plugin-compress-context",
  "packages/teams-built-in",
  "packages/core",
  "packages/config",
  "packages/schema",
];

const REQUIRED_FIELDS = [
  "name",
  "version",
  "license",
  "type",
  "main",
  "types",
  "exports",
  "scripts",
] as const;

function normalizeManifest(pkgPath: string): void {
  const file = join(REPO_ROOT, pkgPath, "package.json");
  const raw = JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>;
  const orqenixExtras: Record<string, unknown> = (raw.orqenix as Record<string, unknown>) ?? {};

  const knownTopLevel = new Set([
    ...REQUIRED_FIELDS,
    "description",
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "files",
    "keywords",
    "repository",
    "bugs",
    "homepage",
    "author",
    "orqenix",
    "publishConfig",
    "engines",
  ]);

  for (const k of Object.keys(raw)) {
    if (!knownTopLevel.has(k)) {
      orqenixExtras[k] = raw[k];
      delete raw[k];
    }
  }
  if (Object.keys(orqenixExtras).length > 0) raw.orqenix = orqenixExtras;

  const defaults = {
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
    license: raw.name && String(raw.name).startsWith("@orqenix-pro/") ? "BSL-1.1" : "Apache-2.0",
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (raw[k] === undefined) raw[k] = v;
  }
  if (!raw.scripts || typeof raw.scripts !== "object") raw.scripts = {};
  const scripts = raw.scripts as Record<string, string>;
  if (!scripts.build) scripts.build = "tsc --build";
  if (!scripts.test) scripts.test = "vitest run";

  writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
  console.log(`  ✓ normalized ${pkgPath}/package.json`);
}

function ensureTeamsBuiltInStubs(): void {
  const root = join(REPO_ROOT, "packages/teams-built-in");
  mkdirSync(join(root, "src"), { recursive: true });

  const indexPath = join(root, "src/index.ts");
  if (!existsSync(indexPath)) {
    writeFileSync(
      indexPath,
      `// SPDX-License-Identifier: Apache-2.0
// @bc Phase4-Teams-BuiltIn
// Stub maintained for Phase 5 baseline. Real teams ship via plugin discovery in Part 12.
export const TEAMS_BUILT_IN_VERSION = '0.4.0-phase-5-stub';
export const TODO_PART_12 = 'replaced by plugin discovery system in Part 12' as const;
`,
    );
    console.log("  ✓ created packages/teams-built-in/src/index.ts");
  }

  const tsconfigPath = join(root, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    writeFileSync(
      tsconfigPath,
      JSON.stringify(
        {
          extends: "../../tsconfig.base.json",
          compilerOptions: { composite: true, outDir: "./dist", rootDir: "./src" },
          include: ["src/**/*"],
          exclude: ["dist", "node_modules"],
        },
        null,
        2,
      ) + "\n",
    );
    console.log("  ✓ created packages/teams-built-in/tsconfig.json");
  }
}

function main(): void {
  console.log("Closing Phase 4 gaps...\n");
  console.log("Gap 1: normalize 6 Phase 4 manifests");
  for (const p of PHASE_4_PACKAGES_WITH_DRIFT) normalizeManifest(p);
  console.log("\nGap 2: complete @orqenix/teams-built-in stubs");
  ensureTeamsBuiltInStubs();
  console.log("\nDone. G1 should now pass more criteria.");
}

main();
