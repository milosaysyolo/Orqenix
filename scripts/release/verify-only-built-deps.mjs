#!/usr/bin/env node
/**
 * Verifies that pnpm.onlyBuiltDependencies allowlist in root package.json
 * matches the canonical Phase 5 set exactly. Prevents accidental supply-chain
 * expansion or accidental removal of required native binding allowlist.
 *
 * Canonical allowlist (5 items, alphabetical):
 *   @mongodb-js/zstd     used by storage-diff (Phase 5 compression layer)
 *   @swc/core            used by build tooling (esbuild alternative for some pkgs)
 *   better-sqlite3       used by ~30 packages (Phase 5 storage layer)
 *   esbuild              used by build tooling
 *   sharp                used by embedding-local (image preprocessing)
 *
 * Usage: node scripts/release/verify-only-built-deps.mjs
 * Exit codes:
 *   0 - allowlist matches exactly
 *   1 - drift detected, JSON details on stderr
 *   2 - precondition failure
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED_ALLOWLIST = ["@mongodb-js/zstd", "@swc/core", "better-sqlite3", "esbuild", "sharp"];

const PKG_PATH = resolve(process.cwd(), "package.json");

if (!existsSync(PKG_PATH)) {
  console.error("[verify-only-built-deps] package.json not found at repo root.");
  process.exit(2);
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
} catch (e) {
  console.error(`[verify-only-built-deps] failed to parse package.json: ${e.message}`);
  process.exit(2);
}

const actual = pkg?.pnpm?.onlyBuiltDependencies ?? [];

const expectedSet = new Set(EXPECTED_ALLOWLIST);
const actualSet = new Set(actual);

const missing = [...expectedSet].filter((x) => !actualSet.has(x)).sort();
const extra = [...actualSet].filter((x) => !expectedSet.has(x)).sort();

if (missing.length === 0 && extra.length === 0) {
  console.log("ALLOWLIST_OK");
  console.log(JSON.stringify({ allowlist: EXPECTED_ALLOWLIST }, null, 2));
  process.exit(0);
}

console.error("ALLOWLIST_DRIFT");
console.error(
  JSON.stringify(
    {
      missing,
      extra,
      expected: EXPECTED_ALLOWLIST,
      actual: [...actualSet].sort(),
      hint:
        missing.length > 0
          ? "Some required native binding allowlist entries are missing from package.json. Add them back."
          : "Extra entries detected. Either add them to EXPECTED_ALLOWLIST in this script (intentional Phase change) or remove from package.json.",
    },
    null,
    2,
  ),
);
process.exit(1);
