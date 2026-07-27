#!/usr/bin/env node
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const OUT_DIR = resolve(REPO_ROOT, "out/v0.7.0-v2");
const EVIDENCE = resolve(OUT_DIR, "evidence");
const RESULTS = resolve(OUT_DIR, "results.jsonl");
const REPORT = resolve(OUT_DIR, "report.md");

mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(RESULTS, "");

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const ALLOW_WINDOWS = args.includes("--allow-windows");
const IS_WINDOWS = platform() === "win32";

const c = {
  cyan: (s) => `\x1b[1;36m${s}\x1b[0m`,
  green: (s) => `\x1b[1;32m${s}\x1b[0m`,
  red: (s) => `\x1b[1;31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[1;33m${s}\x1b[0m`,
  gray: (s) => `\x1b[2m${s}\x1b[0m`,
};

const log = (...a) => console.log(c.cyan("[orchestrator]"), ...a);
const pass = (...a) => console.log(c.green("[PASS]"), ...a);
const fail = (...a) => console.log(c.red("[FAIL]"), ...a);
const skip = (...a) => console.log(c.yellow("[SKIP]"), ...a);

const ITEMS = [
  {
    num: 1,
    id: "rerender-d7.4",
    name: "Re-render D7.4 report",
    severity: "P1",
    script: "01-rerender-d7.4-report.mjs",
    linuxOnly: false,
    evidenceKeywords: ["lines", "PASS", "clean"],
  },
  {
    num: 2,
    id: "benchmarks",
    name: "Measure real benchmarks",
    severity: "P0",
    script: "02-measure-benchmarks.mjs",
    linuxOnly: false,
    evidenceKeywords: ["p95", "env/s", "MEASURED"],
  },
  {
    num: 3,
    id: "fresh-clone",
    name: "Fresh-clone smoke test",
    severity: "P0",
    script: "03-fresh-clone-smoke.mjs",
    linuxOnly: false,
    evidenceKeywords: ["exports", "symbol", "OK"],
  },
  {
    num: 4,
    id: "miniflare",
    name: "Miniflare conformance",
    severity: "P0",
    script: "04-miniflare-conformance.mjs",
    linuxOnly: true,
    evidenceKeywords: ["miniflare", "binding", "PASS"],
  },
  {
    num: 5,
    id: "otlp-grpc",
    name: "OTLP gRPC interop",
    severity: "P0",
    script: "05-otlp-grpc-interop.mjs",
    linuxOnly: true,
    evidenceKeywords: ["orqenix.test.counter", "received", "collector"],
  },
  {
    num: 6,
    id: "provenance",
    name: "Provenance + cosign + tags",
    severity: "P0",
    script: "06-verify-provenance-cosign.mjs",
    linuxOnly: false,
    evidenceKeywords: ["attestations", "v0.7.0", "OK"],
  },
  {
    num: 7,
    id: "pro-deps",
    name: "Pro deps republish audit",
    severity: "P1",
    script: "07-pro-deps-republish-audit.mjs",
    linuxOnly: false,
    evidenceKeywords: ["packages_checked", "failed"],
  },
];

function emitResult(item, status, durMs, reason = "") {
  const line = JSON.stringify({
    id: item.id,
    name: item.name,
    status,
    severity: item.severity,
    duration_ms: durMs,
    evidence: `evidence/item-${item.num}`,
    reason,
    ts: new Date().toISOString(),
  });
  writeFileSync(RESULTS, readFileSync(RESULTS, "utf8") + line + "\n");
}

function evidenceStrong(itemDir, keywords) {
  const stdout = resolve(itemDir, "stdout.log");
  if (!existsSync(stdout)) return { ok: false, reason: "no stdout.log" };
  const stat = statSync(stdout);
  if (stat.size === 0) return { ok: false, reason: "empty stdout.log" };
  const content = readFileSync(stdout, "utf8");
  const missing = keywords.filter((k) => !content.includes(k));
  if (missing.length > 0) {
    return { ok: false, reason: `missing keywords: ${missing.join(", ")}` };
  }
  return { ok: true, reason: "all keywords matched" };
}

function runItem(item) {
  const itemDir = resolve(EVIDENCE, `item-${item.num}`);
  mkdirSync(itemDir, { recursive: true });

  if (item.linuxOnly && IS_WINDOWS && !ALLOW_WINDOWS) {
    skip(`Item ${item.num}: ${item.name} (linux-only, host is Windows)`);
    emitResult(item, "SKIP", 0, "linux-only-host-windows");
    return { status: "SKIP" };
  }

  log(`Running item ${item.num}/${ITEMS.length}: ${item.name} [${item.severity}]`);
  const start = Date.now();
  const scriptPath = resolve(__dirname, item.script);

  if (!existsSync(scriptPath)) {
    fail(`Script not found: ${scriptPath}`);
    emitResult(item, "FAIL", 0, "script-not-found");
    return { status: "FAIL" };
  }

  const res = spawnSync("node", [scriptPath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ITEM_EVIDENCE_DIR: itemDir },
    timeout: 20 * 60 * 1000,
  });

  writeFileSync(resolve(itemDir, "stdout.log"), res.stdout || "");
  writeFileSync(resolve(itemDir, "stderr.log"), res.stderr || "");

  const dur = Date.now() - start;
  const rc = res.status;

  if (rc === 2) {
    skip(`Item ${item.num}: SKIP (${dur}ms)`);
    emitResult(item, "SKIP", dur, "script-returned-2");
    return { status: "SKIP" };
  }

  if (rc !== 0) {
    fail(`Item ${item.num}: ${item.name} (rc=${rc}, ${dur}ms)`);
    emitResult(item, "FAIL", dur, `exit-code-${rc}`);
    return { status: "FAIL" };
  }

  const ev = evidenceStrong(itemDir, item.evidenceKeywords);
  if (!ev.ok) {
    fail(`Item ${item.num}: weak evidence — ${ev.reason}`);
    emitResult(item, "FAIL", dur, `weak-evidence: ${ev.reason}`);
    return { status: "FAIL" };
  }

  pass(`Item ${item.num}: ${item.name} (${dur}ms, evidence OK)`);
  emitResult(item, "PASS", dur, ev.reason);
  return { status: "PASS" };
}

log(
  `Platform: ${platform()}${IS_WINDOWS ? " (linux-only items will SKIP unless --allow-windows)" : ""}`,
);
log(`Strict mode: ${STRICT}`);
log(`Output: ${OUT_DIR}`);

const results = [];
for (const item of ITEMS) {
  const r = runItem(item);
  results.push({ ...item, ...r });
  if (STRICT && r.status === "FAIL" && item.severity === "P0") {
    fail("Strict mode + P0 FAIL — stopping");
    break;
  }
}

log("Generating report");
spawnSync("node", [resolve(__dirname, "generate-report.mjs"), "--in", RESULTS, "--out", REPORT], {
  stdio: "inherit",
});

const p0Fails = results.filter((r) => r.severity === "P0" && r.status === "FAIL");
const p0Skips = results.filter((r) => r.severity === "P0" && r.status === "SKIP");
const p0Passes = results.filter((r) => r.severity === "P0" && r.status === "PASS");
const p0Total = ITEMS.filter((i) => i.severity === "P0").length;

let verdict;
let exitCode;
if (p0Fails.length > 0) {
  verdict = "NO-GO";
  exitCode = 1;
} else if (p0Skips.length > 0 || p0Passes.length < p0Total) {
  verdict = "INCONCLUSIVE";
  exitCode = 2;
} else {
  verdict = "GO";
  exitCode = 0;
}

console.log();
console.log(c.cyan("=".repeat(70)));
console.log(
  `  Verdict: ${
    verdict === "GO" ? c.green(verdict) : verdict === "NO-GO" ? c.red(verdict) : c.yellow(verdict)
  }`,
);
console.log(
  `  P0: ${p0Passes.length} PASS, ${p0Fails.length} FAIL, ${p0Skips.length} SKIP (of ${p0Total})`,
);
console.log(`  Report: ${REPORT}`);
console.log(c.cyan("=".repeat(70)));

process.exit(exitCode);
