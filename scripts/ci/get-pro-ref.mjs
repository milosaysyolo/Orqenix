#!/usr/bin/env node
/**
 * Single source of truth for Orqenix-Pro ref used across workflows.
 * Reads .orqenix/cross-repo-refs.json and prints the pinned ref to stdout.
 *
 * Optional --validate flag exits 1 if file missing or schema invalid.
 *
 * Usage in workflow:
 *   PRO_REF=$(node scripts/ci/get-pro-ref.mjs)
 *   echo "Using Orqenix-Pro ref: $PRO_REF"
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REFS_PATH = resolve(process.cwd(), ".orqenix/cross-repo-refs.json");

const validateOnly = process.argv.includes("--validate");

if (!existsSync(REFS_PATH)) {
  console.error("[get-pro-ref] .orqenix/cross-repo-refs.json not found.");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(readFileSync(REFS_PATH, "utf8"));
} catch (e) {
  console.error(`[get-pro-ref] failed to parse JSON: ${e.message}`);
  process.exit(1);
}

const ref = data?.["orqenix-pro"]?.ref;

if (!ref || typeof ref !== "string") {
  console.error("[get-pro-ref] orqenix-pro.ref missing or invalid.");
  process.exit(1);
}

if (validateOnly) {
  console.error(`[get-pro-ref] OK: ref=${ref}`);
  process.exit(0);
}

// Print only the ref (no trailing newline interference with shell capture)
process.stdout.write(ref);
