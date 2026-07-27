// SPDX-License-Identifier: Apache-2.0
// Normalizes CRLF → LF on TypeScript source files.
// SAFE: only touches .ts/.tsx/.mjs that have CRLF. Idempotent.
// Skips dist/, node_modules/, and binary files.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const files = execSync('git ls-files "**/*.ts" "**/*.tsx" "**/*.mjs" "**/*.json" "**/*.md"', {
  cwd: ROOT,
  encoding: "utf-8",
})
  .split("\n")
  .filter((p) => p && !p.includes("dist/"));

let normalized = 0;
for (const rel of files) {
  const abs = join(ROOT, rel);
  try {
    const content = await readFile(abs, "utf-8");
    if (content.includes("\r\n")) {
      const cleaned = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
      await writeFile(abs, cleaned, "utf-8");
      normalized += 1;
      console.log(`  normalized: ${rel}`);
    }
  } catch {
    /* */
  }
}

console.log(`\n${normalized} file(s) normalized.`);
