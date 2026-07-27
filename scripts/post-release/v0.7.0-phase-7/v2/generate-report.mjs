#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { in: { type: "string" }, out: { type: "string" } } });
const items = readFileSync(values.in, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);

const p0 = items.filter((i) => i.severity === "P0");
const p1 = items.filter((i) => i.severity === "P1");
const p0Pass = p0.filter((i) => i.status === "PASS");
const p0Fail = p0.filter((i) => i.status === "FAIL");
const p0Skip = p0.filter((i) => i.status === "SKIP");

let verdict, icon;
if (p0Fail.length > 0) {
  verdict = "NO-GO";
  icon = "❌";
} else if (p0Skip.length > 0 || p0Pass.length < p0.length) {
  verdict = "INCONCLUSIVE";
  icon = "🟡";
} else {
  verdict = "GO";
  icon = "✅";
}

const lines = [];
lines.push(`# Post-Release Validation Report v2 — v0.7.0`);
lines.push("");
lines.push(`**Verdict:** ${icon} **${verdict}**`);
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push("");
lines.push("## Verdict logic (v2)");
lines.push("");
lines.push("- **GO** — All P0 items PASS with strong evidence");
lines.push("- **INCONCLUSIVE** — At least one P0 SKIP or weak evidence; no P0 FAIL");
lines.push("- **NO-GO** — At least one P0 FAIL");
lines.push("");
lines.push("## P0 status");
lines.push("");
lines.push(`- PASS: ${p0Pass.length}/${p0.length}`);
lines.push(`- FAIL: ${p0Fail.length}`);
lines.push(`- SKIP: ${p0Skip.length}`);
lines.push("");
lines.push("## P1 status");
lines.push("");
lines.push(`- PASS: ${p1.filter((i) => i.status === "PASS").length}/${p1.length}`);
lines.push(`- FAIL: ${p1.filter((i) => i.status === "FAIL").length}`);
lines.push(`- SKIP: ${p1.filter((i) => i.status === "SKIP").length}`);
lines.push("");
lines.push("## Item Results");
lines.push("");
lines.push("| # | Item | Severity | Status | Duration | Reason | Evidence |");
lines.push("|---|------|----------|--------|----------|--------|----------|");
items.forEach((it, i) => {
  const s = it.status === "PASS" ? "✅" : it.status === "FAIL" ? "❌" : "⏭️";
  lines.push(
    `| ${i + 1} | ${it.name} | ${it.severity} | ${s} ${it.status} | ${it.duration_ms}ms | ${it.reason || "-"} | \`${it.evidence}\` |`,
  );
});

if (p0Fail.length > 0) {
  lines.push("");
  lines.push("## ❌ P0 Failures (blocking)");
  p0Fail.forEach((f) => lines.push(`- **${f.name}** — ${f.reason}`));
}
if (p0Skip.length > 0) {
  lines.push("");
  lines.push("## 🟡 P0 Skipped (must run on Linux/CI)");
  p0Skip.forEach((s) => lines.push(`- **${s.name}** — ${s.reason}`));
}

lines.push("");
lines.push("## Next steps");
lines.push("");
if (verdict === "GO") {
  lines.push("1. Checkpoint: `v0.7.0 post-release validation GO on YYYY-MM-DD`");
  lines.push("2. Announce on GitHub Discussions + Discord + Twitter");
  lines.push("3. Begin Phase 8 D8.α.2 UI primitives delivery");
} else if (verdict === "INCONCLUSIVE") {
  lines.push("1. Re-run on Linux: `gh workflow run post-release-validation-v2.yml`");
  lines.push("2. If on local Windows, install WSL2 then `node run-all.mjs --strict`");
  lines.push("3. Do NOT announce production-ready until P0 SKIP items have real PASS evidence");
} else {
  lines.push("1. Fix P0 failures, see evidence/item-N/stderr.log");
  lines.push(
    "2. If Pro deps issue: `node scripts/post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs`",
  );
  lines.push("3. Re-run orchestrator with `--strict`");
  lines.push("4. Consider cutting v0.7.1 patch if a structural fix needed");
}

writeFileSync(values.out, lines.join("\n") + "\n");
console.log(`Report: ${values.out}`);
