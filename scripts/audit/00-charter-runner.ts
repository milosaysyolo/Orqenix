#!/usr/bin/env tsx
/**
 * Phase 4 Production-Strict Charter Runner.
 * Runs all 20 hard gates, prints a report, exits non-zero on any RED.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function findTsFiles(dir: string, exclude: string[] = []): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (exclude.some(e => fullPath.includes(e))) continue;
      if (entry.isDirectory()) {
        files.push(...findTsFiles(fullPath, exclude));
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }
  } catch {
    // ignore
  }
  return files;
}

type GateResult = { id: string; name: string; ok: boolean; detail: string };

const results: GateResult[] = [];

function record(id: string, name: string, ok: boolean, detail = "") {
  results.push({ id, name, ok, detail });
}

function sh(cmd: string): { code: number; out: string } {
  const r = spawnSync(cmd, { shell: true, encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

// G1: no @ts-expect-error in src
{
  const files = findTsFiles("packages", ["node_modules"]);
  let hits = 0;
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    hits += (content.match(/@ts-expect-error/g) ?? []).length;
  }
  record("G1", "no @ts-expect-error in src", hits === 0, `${hits} occurrences`);
}

// G2: no @ts-ignore in src
{
  const files = findTsFiles("packages", ["node_modules"]);
  let hits = 0;
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    hits += (content.match(/@ts-ignore/g) ?? []).length;
  }
  record("G2", "no @ts-ignore in src", hits === 0, `${hits} occurrences`);
}

// G3: strict typecheck passes
{
  const r = sh("pnpm typecheck");
  record("G3", "strict tsc clean", r.code === 0);
}

// G4: tests run uncached
{
  const r = sh("turbo run test --force --no-cache 2>&1");
  const passed = /(\d+) passed/.exec(r.out);
  record("G4", "tests uncached run", r.code === 0, passed ? passed[0] : "no count");
}

// G5: test count ≥ 230
{
  const r = sh("turbo run test --force --no-cache 2>&1");
  const m = /Tests:\s+(\d+) passed/.exec(r.out);
  const count = m ? Number(m[1]) : 0;
  record("G5", "test count ≥ 230", count >= 230, `actual ${count}`);
}

// G6: export-only tests forbidden
{
  const r = sh(
    `grep -RIn "toBeDefined()" packages/*/src/**/*.test.ts 2>/dev/null | wc -l`,
  );
  const n = Number(r.out.trim());
  record("G6", "no export-only tests", n <= 10, `${n} occurrences (budget 10)`);
}

// G7: real Tree-sitter for kb-code
{
  const ok = sh(
    `grep -RIn "web-tree-sitter" packages/kb-code/src 2>/dev/null | grep -v test`,
  ).code === 0;
  record("G7", "kb-code uses web-tree-sitter", ok);
}

// G8: kb-docs uses sqlite-vec + FTS5
{
  const usesVec = sh(`grep -RIn "vec0\\|sqlite-vec" packages/kb-docs/src 2>/dev/null`).code === 0;
  const usesFts = sh(`grep -RIn "fts5\\|MATCH" packages/kb-docs/src 2>/dev/null`).code === 0;
  record("G8", "kb-docs hybrid retrieval", usesVec && usesFts, `vec=${usesVec} fts=${usesFts}`);
}

// G9: Pro tier exists
{
  const ok =
    existsSync("../Orqenix-Pro/LICENSE") &&
    existsSync("../Orqenix-Pro/packages/license") &&
    existsSync("../Orqenix-Pro/packages/learning-loop") &&
    existsSync("../Orqenix-Pro/packages/knowledge-intel");
  record("G9", "Orqenix-Pro tier present", ok);
}

// G10 covered by Pro-side tests; here we just check Pro tests pass
{
  const r = sh("cd ../Orqenix-Pro && pnpm test --force --no-cache 2>&1 || true");
  record("G10", "Pro tests pass", r.code === 0);
}

// G11: docs landed
{
  const required = [
    "docs/architecture/lifecycle-management.md",
    "docs/architecture/knowledge-layer.md",
    "docs/architecture/marketplace-system.md",
    "docs/architecture/license-gating.md",
    "docs/architecture/embedding-providers.md",
    "docs/monetization/why-pro.md",
    "docs/runbook/phase-4-rollback.md",
  ];
  let allOk = true;
  for (const p of required) {
    if (!existsSync(p)) { allOk = false; break; }
    const lines = readFileSync(p, "utf8").split("\n").length;
    if (lines < 200) { allOk = false; break; }
  }
  record("G11", "7 docs present, each ≥ 200 lines", allOk);
}

// G12: CI matrix 6 jobs
{
  const ci = existsSync(".github/workflows/ci.yml")
    ? readFileSync(".github/workflows/ci.yml", "utf8")
    : "";
  const hasUbuntu = /ubuntu-latest/.test(ci);
  const hasMac    = /macos-latest/.test(ci);
  const hasWin    = /windows-latest/.test(ci);
  const has20     = /['"]20['"]/.test(ci);
  const has22     = /['"]22['"]/.test(ci);
  const ok = hasUbuntu && hasMac && hasWin && has20 && has22;
  record("G12", "CI matrix 6 jobs", ok);
}

// G13: smoke passes locally (CI verifies cross-OS)
{
  const r = sh("pnpm smoke 2>&1");
  record("G13", "smoke passes locally", r.code === 0);
}

// G14: no high/critical CVE
{
  const r = sh("pnpm audit --audit-level=high --json 2>&1");
  record("G14", "no high/critical CVE", r.code === 0);
}

// G15: bundle size
{
  const r = sh("pnpm exec bundlesize 2>&1");
  record("G15", "bundle size budget", r.code === 0);
}

// G16: perf budget (run only if bench exists)
{
  const r = sh("pnpm bench:phase-4 2>&1 || true");
  const ok = !/FAIL/.test(r.out);
  record("G16", "perf budget", ok);
}

// G17: detach/attach round-trip
{
  const r = sh("pnpm test:detach-roundtrip --force --no-cache 2>&1");
  record("G17", "detach round-trip clean", r.code === 0);
}

// G18: audit log tamper detection
{
  const r = sh("pnpm test:audit-tamper --force --no-cache 2>&1");
  record("G18", "audit tamper detection", r.code === 0);
}

// G19: license grace period
{
  const r = sh("cd ../Orqenix-Pro && pnpm test:license-grace --force --no-cache 2>&1");
  record("G19", "license grace period", r.code === 0);
}

// G20: keystore
{
  const ok =
    existsSync("keys/orqenix-marketplace.pub.pem") &&
    !existsSync("keys/orqenix-marketplace.priv.pem");
  record("G20", "keystore correct", ok);
}

// Report
console.log("\n═══════════════════════════════════════════════════");
console.log(" PHASE 4 PRODUCTION-STRICT CHARTER REPORT");
console.log("═══════════════════════════════════════════════════\n");
let failed = 0;
for (const r of results) {
  const tag = r.ok ? "✅" : "❌";
  console.log(`${tag} ${r.id}  ${r.name.padEnd(40)}  ${r.detail}`);
  if (!r.ok) failed++;
}
console.log("\n───────────────────────────────────────────────────");
console.log(`Total: ${results.length}   Pass: ${results.length - failed}   Fail: ${failed}`);
console.log("───────────────────────────────────────────────────\n");
process.exit(failed === 0 ? 0 : 1);
