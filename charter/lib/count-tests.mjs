#!/usr/bin/env node
// Count total tests via vitest JSON reporter (no fragile regex).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const target = Number(process.argv[2] ?? 230);
const out = ".charter/test-results.json";

spawnSync(
  "pnpm",
  ["-r", "exec", "vitest", "run", "--reporter=json", `--outputFile=${out}`],
  { stdio: "inherit" },
);

let total = 0;
const fs = await import("node:fs");
const path = await import("node:path");
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "test-results.json") {
      try {
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        total += j.numPassedTests ?? 0;
      } catch {
        /* skip */
      }
    }
  }
};
for (const pkg of fs.readdirSync("packages")) {
  const dir = path.join("packages", pkg, ".charter");
  if (fs.existsSync(dir)) walk(dir);
}
console.log(`Total tests passed: ${total} (target: ${target})`);
process.exit(total >= target ? 0 : 1);
