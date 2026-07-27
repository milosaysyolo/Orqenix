// SPDX-License-Identifier: Apache-2.0
// Captures the EXACT failure messages from a single failing test package.
// Required because "130p 12f" summaries hide what actually fails.
//
// Run: node scripts/verify/capture-test-failures.mjs @orqenix/memory-engine

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("Usage: capture-test-failures.mjs <package-name>");
  console.error("Example: capture-test-failures.mjs @orqenix/memory-engine");
  process.exit(1);
}

console.log(`Capturing test output for ${target}...`);
const start = Date.now();
const r = spawnSync("pnpm", ["--filter", target, "run", "test", "--reporter=verbose"], {
  encoding: "utf-8",
  shell: process.platform === "win32",
  timeout: 180000,
});

const report = {
  target,
  timestamp: new Date().toISOString(),
  platform: { os: process.platform, arch: process.arch, node: process.version },
  exitCode: r.status,
  durationMs: Date.now() - start,
  stdout: r.stdout ?? "",
  stderr: r.stderr ?? "",
};

// Extract individual FAIL lines
const failLines = (r.stdout ?? "").split("\n").filter((l) => /✗|FAIL|Error:/.test(l));
report.failureLines = failLines;

// Extract error blocks (vitest format)
const errorBlocks = [];
const lines = (r.stdout ?? "").split("\n");
for (let i = 0; i < lines.length; i++) {
  if (/✗|FAIL/.test(lines[i])) {
    errorBlocks.push(lines.slice(i, Math.min(i + 15, lines.length)).join("\n"));
  }
}
report.errorBlocks = errorBlocks;

const outFile = `test-failure-${target.replace(/[@/]/g, "_")}.json`;
writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`\nReport: ${outFile}`);
console.log(`Exit code: ${r.status}`);
console.log(`Failures detected: ${failLines.length}`);
console.log(`\nFirst 3 error blocks:\n`);
errorBlocks.slice(0, 3).forEach((b, i) => {
  console.log(`\u2500\u2500 Block ${i + 1} \u2500\u2500`);
  console.log(b);
  console.log();
});
process.exit(0);
