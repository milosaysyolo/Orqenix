#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const EVIDENCE = process.env.ITEM_EVIDENCE_DIR || resolve(process.cwd(), "out/item-2");
mkdirSync(EVIDENCE, { recursive: true });

const TARGETS = {
  rtt_same_region_p95_ms: 80,
  rtt_cross_region_p95_ms: 250,
  throughput_env_per_sec: 2000,
};

function run(cmd, args, file) {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: process.cwd(), timeout: 5 * 60 * 1000 });
  writeFileSync(
    resolve(EVIDENCE, file),
    `STDOUT:\n${r.stdout || ""}\nSTDERR:\n${r.stderr || ""}\n`,
  );
  return r;
}

console.log("[02] Building bench targets...");
const b1 = run("pnpm", ["--filter", "@orqenix-cloud/relay-core", "build"], "build-core.log");
const b2 = run(
  "pnpm",
  ["--filter", "@orqenix-cloud/relay-transport", "build"],
  "build-transport.log",
);
const b3 = run(
  "pnpm",
  ["--filter", "@orqenix-cloud/relay-protocol", "build"],
  "build-protocol.log",
);

if ([b1, b2, b3].some((r) => r.status !== 0)) {
  console.error("[02] Bench package build FAIL");
  process.exit(1);
}

console.log("[02] Running RTT benchmark...");
const rtt = run(
  "pnpm",
  [
    "--filter",
    "@orqenix-cloud/relay-core",
    "exec",
    "vitest",
    "bench",
    "bench/rtt.bench.ts",
    "--run",
  ],
  "rtt.log",
);

console.log("[02] Running throughput benchmark...");
const tps = run(
  "pnpm",
  [
    "--filter",
    "@orqenix-cloud/relay-core",
    "exec",
    "vitest",
    "bench",
    "bench/throughput.bench.ts",
    "--run",
  ],
  "throughput.log",
);

function parsePct(logText, label) {
  const lines = logText.split("\n");
  for (const line of lines) {
    if (line.toLowerCase().includes(label.toLowerCase())) {
      const m = line.match(/([\d,.]+)\s*(ms|env\/s|ops\/s)/);
      if (m) return parseFloat(m[1].replace(/,/g, ""));
    }
  }
  return null;
}

const rttLog = readFileSync(resolve(EVIDENCE, "rtt.log"), "utf8");
const tpsLog = readFileSync(resolve(EVIDENCE, "throughput.log"), "utf8");

const measured = {
  rtt_same_region_p95_ms: parsePct(rttLog, "same-region"),
  rtt_cross_region_p95_ms: parsePct(rttLog, "cross-region"),
  throughput_env_per_sec: parsePct(tpsLog, "env/s") || parsePct(tpsLog, "throughput"),
};

const summary = { targets: TARGETS, measured, status: {} };
const failures = [];

for (const [k, target] of Object.entries(TARGETS)) {
  const m = measured[k];
  if (m === null) {
    summary.status[k] = "NO_MEASUREMENT";
    failures.push(`${k}: no measurement extracted from bench output`);
  } else if (k.includes("rtt") && m > target) {
    summary.status[k] = "EXCEEDS_TARGET";
    failures.push(`${k}: measured ${m}ms > target ${target}ms`);
  } else if (k === "throughput_env_per_sec" && m < target) {
    summary.status[k] = "BELOW_TARGET";
    failures.push(`${k}: measured ${m} env/s < target ${target} env/s`);
  } else {
    summary.status[k] = "MEASURED";
  }
}

writeFileSync(resolve(EVIDENCE, "summary.json"), JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error("[02] Benchmark FAIL:");
  failures.forEach((f) => console.error("  -", f));
  console.log(`[02] Summary: ${JSON.stringify(summary.status)}`);
  process.exit(1);
}

console.log("[02] All MEASURED:");
console.log(
  `  RTT same-region p95: ${measured.rtt_same_region_p95_ms}ms (target ≤${TARGETS.rtt_same_region_p95_ms}ms)`,
);
console.log(
  `  RTT cross-region p95: ${measured.rtt_cross_region_p95_ms}ms (target ≤${TARGETS.rtt_cross_region_p95_ms}ms)`,
);
console.log(
  `  Throughput: ${measured.throughput_env_per_sec} env/s (target ≥${TARGETS.throughput_env_per_sec})`,
);
process.exit(0);
