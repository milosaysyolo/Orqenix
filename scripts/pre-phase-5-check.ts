#!/usr/bin/env tsx

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import consola from "consola";

consola.start("Pre-Phase-5 Check\n");

let allPass = true;

// 1. Check git status
try {
  const status = execSync("git status --porcelain", { encoding: "utf-8" });
  if (status.trim()) {
    consola.warn("Uncommitted changes detected. Commit first.");
    allPass = false;
  } else {
    consola.success("Git working tree clean");
  }
} catch {
  consola.warn("Not a git repository or git unavailable");
}

// 2. Check Node version
const nodeVersion = process.version;
consola.info(`Node: ${nodeVersion}`);

// 3. Check pnpm version
try {
  const pnpmVersion = execSync("pnpm --version", { encoding: "utf-8" }).trim();
  consola.info(`pnpm: ${pnpmVersion}`);
} catch {
  consola.error("pnpm not found");
  allPass = false;
}

// 4. Verify core files
const required = [
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "package.json",
  "packages/core/src/blake3.ts",
  "packages/core/src/result.ts",
  "packages/core/src/errors.ts",
  "packages/core/src/branded-types.ts",
  "packages/core/src/canonical-json.ts",
  "packages/gate-runner-core/src/index.ts",
  "packages/_meta/phase-5-readiness.ts",
  "scripts/verify-phase-4-stubs.ts",
  "scripts/charter-gates/G1-phase4-stubs-wired.ts",
  ".prettierrc.json",
];

let missingCount = 0;
for (const f of required) {
  if (!existsSync(f)) {
    consola.error(`Missing: ${f}`);
    missingCount++;
    allPass = false;
  }
}
if (missingCount === 0) consola.success("All required files present");

// 5. Check package.json scripts
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
const requiredScripts = ["verify-phase-5", "verify-phase-4-stubs", "test:charter:G1"];
for (const s of requiredScripts) {
  if (!pkg.scripts?.[s]) {
    consola.error(`Missing script: ${s}`);
    allPass = false;
  }
}
if (requiredScripts.every((s) => pkg.scripts?.[s])) {
  consola.success("All required scripts present");
}

consola.info(`\nPre-check ${allPass ? "PASSED" : "FAILED"}`);
process.exit(allPass ? 0 : 1);
