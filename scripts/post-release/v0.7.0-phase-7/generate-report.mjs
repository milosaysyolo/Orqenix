#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    in: { type: "string" },
    out: { type: "string" },
  },
});

const lines = readFileSync(values.in, "utf8").trim().split("\n").filter(Boolean);
const items = lines.map((l) => JSON.parse(l));

const p0Fails = items.filter((i) => i.severity === "P0" && i.status === "FAIL");
const p1Fails = items.filter((i) => i.severity === "P1" && i.status === "FAIL");
const skips = items.filter((i) => i.status === "SKIP");
const passes = items.filter((i) => i.status === "PASS");

const verdict = p0Fails.length === 0 ? "GO" : "NO-GO";

const lines_out = [];
lines_out.push("# Post-Release Validation Report — v0.7.0-phase-7");
lines_out.push("");
lines_out.push(`**Verdict:** ${verdict === "GO" ? "✅ GO" : "❌ NO-GO"}`);
lines_out.push(`**Generated:** ${new Date().toISOString()}`);
lines_out.push("");
lines_out.push("## Summary");
lines_out.push("");
lines_out.push(`- PASS: ${passes.length}`);
lines_out.push(`- FAIL (P0): ${p0Fails.length}`);
lines_out.push(`- FAIL (P1): ${p1Fails.length}`);
lines_out.push(`- SKIP: ${skips.length}`);
lines_out.push("");
lines_out.push("## Item Results");
lines_out.push("");
lines_out.push("| # | Item | Severity | Status | Duration | Evidence |");
lines_out.push("|---|------|----------|--------|----------|----------|");
items.forEach((it, i) => {
  const icon = it.status === "PASS" ? "✅" : it.status === "FAIL" ? "❌" : "⏭️";
  lines_out.push(
    `| ${i + 1} | ${it.name} | ${it.severity} | ${icon} ${it.status} | ${it.duration_ms}ms | \`${it.evidence}\` |`,
  );
});

if (p0Fails.length > 0) {
  lines_out.push("");
  lines_out.push("## ❌ P0 Failures (blocking)");
  lines_out.push("");
  p0Fails.forEach((f) => {
    lines_out.push(`- **${f.name}** — see \`${f.evidence}/stderr.log\``);
  });
}

if (p1Fails.length > 0) {
  lines_out.push("");
  lines_out.push("## ⚠️ P1 Failures (non-blocking, fix in next patch)");
  lines_out.push("");
  p1Fails.forEach((f) => {
    lines_out.push(`- ${f.name} — see \`${f.evidence}/stderr.log\``);
  });
}

if (skips.length > 0) {
  lines_out.push("");
  lines_out.push("## ⏭️ Skipped");
  lines_out.push("");
  skips.forEach((s) => {
    lines_out.push(`- ${s.name} — \`${s.evidence}\``);
  });
}

lines_out.push("");
lines_out.push("## Next Steps");
lines_out.push("");
if (verdict === "GO") {
  lines_out.push("1. Checkpoint memory: `v0.7.0-phase-7 post-release validation GO on YYYY-MM-DD`");
  lines_out.push("2. Update README badges and release notes with measured benchmark values");
  lines_out.push("3. Announce on GitHub Discussions + Discord + Twitter");
  lines_out.push("4. Begin Phase 8 OSS expansion");
} else {
  lines_out.push("1. Address P0 failures above");
  lines_out.push("2. Re-run `bash scripts/post-release/v0.7.0-phase-7/run-all.sh --strict`");
  lines_out.push("3. Consider v0.7.1-phase-7 patch release");
}

writeFileSync(values.out, lines_out.join("\n") + "\n", "utf8");
console.log(`Report written: ${values.out}`);
