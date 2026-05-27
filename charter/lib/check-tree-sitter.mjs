#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "packages/kb-code/src";
let found = false;
for (const f of readdirSync(dir)) {
  if (f.includes(".test.")) continue;
  if (!/\.(ts|js)$/.test(f)) continue;
  const c = readFileSync(join(dir, f), "utf8");
  if (/from\s+['"]web-tree-sitter['"]/.test(c) || /require\(['"]web-tree-sitter['"]\)/.test(c)) {
    found = true;
    console.log(`OK: ${f} uses web-tree-sitter`);
  }
}
process.exit(found ? 0 : 1);
