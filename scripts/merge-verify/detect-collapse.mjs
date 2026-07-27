#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// detect-collapse.mjs — Scans for SILENT collapses: .ts/.tsx files where code
// has been squeezed into too few lines (merge artifact or script bug).
//
// Detection criteria:
//   CRITICAL: Non-empty .ts/.tsx with ≤3 non-blank lines AND >200 bytes
//   WARNING:  Any single line >800 chars
//   WARNING:  Any .ts/.tsx file ≤5 lines total AND >500 bytes
//
// Usage:
//   node scripts/merge-verify/detect-collapse.mjs [--fix] [--json]
//
// Exit codes: 0 = no critical findings, 1 = critical collapses found

import { readFile, stat } from "node:fs/promises";
import { execSync } from "node:child_process";
import { resolve, extname, relative } from "node:path";

const ROOT = process.cwd();
const FIX_MODE = process.argv.includes("--fix");
const JSON_MODE = process.argv.includes("--json");

const findings = [];

function classify(content, filePath) {
  const lines = content.split("\n");
  const nonBlank = lines.filter((l) => l.trim().length > 0);
  const maxLineLen = Math.max(...lines.map((l) => l.length), 0);
  const byteSize = Buffer.byteLength(content, "utf-8");

  const issues = [];

  // CRITICAL: file has content but almost no newlines
  if (nonBlank.length <= 3 && byteSize > 200) {
    issues.push({
      severity: "CRITICAL",
      message: `Collapsed to ${nonBlank.length} non-blank lines (${byteSize} bytes)`,
    });
  }

  // WARNING: individual line too long
  if (maxLineLen > 800) {
    issues.push({
      severity: "WARNING",
      message: `Longest line is ${maxLineLen} chars`,
    });
  }

  // WARNING: file too short for its size
  if (lines.length <= 5 && byteSize > 500) {
    issues.push({
      severity: "WARNING",
      message: `Only ${lines.length} lines for ${byteSize} bytes`,
    });
  }

  return issues;
}

async function scan() {
  let sources;
  try {
    sources = execSync('git ls-files "**/*.ts" "**/*.tsx" "!**/node_modules/**" "!**/dist/**"', {
      cwd: ROOT,
      encoding: "utf-8",
    })
      .split("\n")
      .filter(Boolean);
  } catch {
    console.error("Failed to list git files. Ensure this is a git repository.");
    process.exit(1);
  }

  for (const rel of sources) {
    const abs = resolve(ROOT, rel);
    let content;
    try {
      content = await readFile(abs, "utf-8");
    } catch {
      continue;
    }

    const issues = classify(content, rel);
    if (issues.length > 0) {
      findings.push({ file: rel, issues, size: Buffer.byteLength(content, "utf-8") });
    }
  }

  return findings;
}

function printReport(findings) {
  if (JSON_MODE) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }

  if (findings.length === 0) {
    console.log("  OK No collapsed files detected");
    return;
  }

  const criticals = findings.filter((f) => f.issues.some((i) => i.severity === "CRITICAL"));
  const warnings = findings.filter((f) => !f.issues.some((i) => i.severity === "CRITICAL"));

  console.log(`\n  Found ${findings.length} suspicious file(s):`);
  console.log(`    ${criticals.length} CRITICAL, ${warnings.length} WARNING\n`);

  for (const f of findings) {
    const rel = relative(ROOT, f.file).replace(/\\/g, "/");
    const sev = f.issues.some((i) => i.severity === "CRITICAL") ? "CRITICAL" : "WARNING";
    console.log(`  [${sev}] ${rel}`);
    for (const issue of f.issues) {
      console.log(`         ${issue.message}`);
    }
  }
}

// Main
const result = await scan();
printReport(result);

const hasCritical = result.some((f) => f.issues.some((i) => i.severity === "CRITICAL"));
if (hasCritical) {
  console.log(
    `\n  ${result.length} file(s) need attention. Run fix scripts to restore proper formatting.`,
  );
}
process.exit(hasCritical ? 1 : 0);
