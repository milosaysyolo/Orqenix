#!/usr/bin/env node
// Reject test files that only check exports without behavior assertions.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BEHAVIOR_PATTERNS = [
  /\btoEqual\b/, /\btoBe\b/, /\btoContain\b/, /\btoThrow\b/, /\btoMatchObject\b/,
  /\btoStrictEqual\b/, /\btoHaveBeenCalled/, /\btoBeGreaterThan\b/, /\toBeLessThan\b/,
  /\bexpect\([^)]+\)\.resolves\b/, /\bexpect\([^)]+\)\.rejects\b/,
];

const EXPORT_ONLY_PATTERNS = [
  /toBeDefined\b/, /typeof\s+\w+\s*===\s*['"]function['"]/, /typeof\s+\w+\s*===\s*['"]object['"]/,
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && !e.name.includes("node_modules") && !e.name.includes("dist")) walk(p, out);
    else if (/\.test\.(ts|js)$/.test(e.name)) out.push(p);
  }
}

const files = [];
walk("packages", files);

let failed = 0;
for (const f of files) {
  const content = readFileSync(f, "utf8");
  const hasBehavior = BEHAVIOR_PATTERNS.some((re) => re.test(content));
  const hasOnlyExport = EXPORT_ONLY_PATTERNS.some((re) => re.test(content));
  if (hasOnlyExport && !hasBehavior) {
    console.error(`EXPORT-ONLY: ${f}`);
    failed++;
  }
}
console.log(`Checked ${files.length} test files, ${failed} export-only`);
process.exit(failed === 0 ? 0 : 1);
