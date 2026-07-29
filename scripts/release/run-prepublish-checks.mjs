#!/usr/bin/env node
/**
 * Pre-publish checks (C01 to C24) runner.
 * Reads .orqenix/release/publishable-whitelist.yaml and runs each check.
 * Returns non-zero exit code if any check fails.
 *
 * If checks file or whitelist missing, exits 0 with warning (acceptable
 * for v0.5.0 setup phase before full release infra ships).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const WHITELIST_PATH = resolve(ROOT, ".orqenix/release/publishable-whitelist.yaml");
const CHECKS_DIR = resolve(ROOT, "scripts/release/checks");

if (!existsSync(WHITELIST_PATH)) {
  console.warn("[prepublish-checks] whitelist not found; emitting WARNING and exiting 0.");
  console.warn(`  Expected: ${WHITELIST_PATH}`);
  console.warn("  This is acceptable during v0.5.0 setup phase. Full checks ship with S3 batch.");
  process.exit(0);
}

if (!existsSync(CHECKS_DIR)) {
  console.warn("[prepublish-checks] checks directory not found; skipping individual checks.");
  process.exit(0);
}

const checkFiles = readdirSync(CHECKS_DIR)
  .filter((f) => /^C\d{2,}-.*\.mjs$/.test(f))
  .sort();

// Preload all package data once so checks don't each re-read disk
const { preloadPackages } = await import(pathToFileURL(join(CHECKS_DIR, "_helpers.mjs")).href);
preloadPackages();

if (checkFiles.length === 0) {
  console.warn("[prepublish-checks] no C##-*.mjs check files found; skipping.");
  process.exit(0);
}

console.log(`[prepublish-checks] Running ${checkFiles.length} checks...`);

let failed = [];
for (const file of checkFiles) {
  const checkPath = join(CHECKS_DIR, file);
  try {
    const mod = await import(pathToFileURL(checkPath).href);
    if (typeof mod.run !== "function") {
      console.warn(`  SKIP ${file}: no exported run() function`);
      continue;
    }
    await mod.run();
    console.log(`  PASS ${file}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  FAIL ${file}: ${msg}`);
    failed.push(file);
  }
}

if (failed.length > 0) {
  console.error(`\n[prepublish-checks] ${failed.length} checks failed:`);
  failed.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log(`\n[prepublish-checks] All ${checkFiles.length} checks passed.`);
process.exit(0);
