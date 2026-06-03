#!/usr/bin/env tsx

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import consola from "consola";

const quick = process.argv.includes("--quick");
const report = process.argv.includes("--report");

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, pass: true, detail: "OK" });
  } catch (err: any) {
    results.push({ name, pass: false, detail: err.message });
  }
}

consola.start("Phase 5 Verification\n");

check("Root configs exist", () => {
  const required = ["tsconfig.base.json", "turbo.json", "pnpm-workspace.yaml", "package.json"];
  const missing = required.filter((f) => !existsSync(f));
  if (missing.length > 0) throw new Error(`Missing: ${missing.join(", ")}`);
});

check("@orqenix/core exists", () => {
  if (!existsSync("packages/core/package.json")) throw new Error("core package missing");
});

check("BLAKE3 module exists", () => {
  if (!existsSync("packages/core/src/blake3.ts")) throw new Error("blake3.ts missing");
});

check("Canonical JSON module exists", () => {
  if (!existsSync("packages/core/src/canonical-json.ts"))
    throw new Error("canonical-json.ts missing");
});

check("Result type exists", () => {
  if (!existsSync("packages/core/src/result.ts")) throw new Error("result.ts missing");
});

check("Error classes exist", () => {
  if (!existsSync("packages/core/src/errors.ts")) throw new Error("errors.ts missing");
});

check("Branded types exist", () => {
  if (!existsSync("packages/core/src/branded-types.ts"))
    throw new Error("branded-types.ts missing");
});

check("Gate runner core exists", () => {
  if (!existsSync("packages/gate-runner-core/src/index.ts"))
    throw new Error("gate-runner-core missing");
});

check("Phase 5 metadata exists", () => {
  if (!existsSync("packages/_meta/phase-5-readiness.ts")) throw new Error("_meta missing");
});

check("Charter gate G1 exists", () => {
  if (!existsSync("scripts/charter-gates/G1-phase4-stubs-wired.ts"))
    throw new Error("G1 script missing");
});

if (!quick) {
  check("Workspace builds", () => {
    execSync("pnpm build", { stdio: "pipe", encoding: "utf-8", timeout: 120_000 });
  });
}

const passed = results.filter((r) => r.pass).length;
const total = results.length;

consola.info(`\n${passed}/${total} checks passed\n`);

for (const r of results) {
  const icon = r.pass ? "✓" : "✗";
  consola.info(`  ${icon} ${r.name}: ${r.detail}`);
}

if (report) {
  const reportData = {
    timestamp: new Date().toISOString(),
    checks: results,
    summary: { passed, total },
  };
  console.log(`\nREPORT: ${JSON.stringify(reportData, null, 2)}`);
}

process.exit(passed === total ? 0 : 1);
