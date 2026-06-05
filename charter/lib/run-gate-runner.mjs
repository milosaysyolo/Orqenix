#!/usr/bin/env node
// Bundles a TypeScript gate runner to a standalone ESM file with esbuild,
// then executes it with plain `node`. This avoids tsx's CJS/ESM interop
// landmines (MODULE_NOT_FOUND on ESM-only deps, ERR_REQUIRE_CYCLE_MODULE on
// require cycles) inside the charter Docker container.
//
// Usage: node charter/lib/run-gate-runner.mjs scripts/gates/G17-detach-roundtrip.ts
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";

const entry = process.argv[2];
if (!entry) {
  console.error("usage: run-gate-runner.mjs <path-to-gate-runner.ts>");
  process.exit(2);
}

const outDir = mkdtempSync(join(tmpdir(), "orqenix-gate-"));
const outfile = join(outDir, basename(entry).replace(/\.ts$/, ".mjs"));

try {
  await build({
    entryPoints: [entry],
    outfile,
    format: "esm",
    bundle: true,
    platform: "node",
    target: "node22",
    // Keep native/optional deps external so esbuild doesn't try to bundle
    // better-sqlite3 .node bindings or other native modules.
    packages: "external",
    logLevel: "warning",
  });
} catch (e) {
  console.error(`[run-gate-runner] bundle failed: ${e.message}`);
  process.exit(1);
}

const res = spawnSync("node", [outfile], {
  stdio: "inherit",
  env: process.env,
});

process.exit(res.status ?? 1);
