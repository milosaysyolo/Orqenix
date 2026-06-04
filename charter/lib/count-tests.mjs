#!/usr/bin/env node
// Count total tests via vitest JSON reporter (single root run, no per-package exec).
// Running `pnpm -r exec vitest` fails in packages without vitest (e.g. _meta);
// the root vitest config already includes all package tests, so one run suffices.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const target = Number(process.argv[2] ?? 230);
const out = ".charter/test-results.json";

mkdirSync(dirname(out), { recursive: true });

const res = spawnSync("pnpm", ["exec", "vitest", "run", "--reporter=json", `--outputFile=${out}`], {
  stdio: ["ignore", "inherit", "inherit"],
  env: {
    ...process.env,
    HF_HUB_OFFLINE: "1",
    TRANSFORMERS_OFFLINE: "1",
  },
});

if (res.status !== 0) {
  console.error(`vitest exited with status ${res.status}`);
  // Continue: some suites may fail but we still want the count if file exists.
}

if (!existsSync(out)) {
  console.error(`Test results file not produced at ${out}`);
  process.exit(1);
}

let total = 0;
try {
  const j = JSON.parse(readFileSync(out, "utf8"));
  total = j.numPassedTests ?? 0;
} catch (e) {
  console.error(`Failed to parse ${out}: ${e.message}`);
  process.exit(1);
}

console.log(`Total tests passed: ${total} (target: ${target})`);
process.exit(total >= target ? 0 : 1);
