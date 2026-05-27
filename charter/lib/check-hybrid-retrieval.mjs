#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "packages/kb-docs/src";
let hasVec = false;
let hasFts = false;
const walk = (d) => {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(join(d, f.name));
    else if (/\.(ts|js)$/.test(f.name) && !f.name.includes(".test.")) {
      const c = readFileSync(join(d, f.name), "utf8");
      if (/vec0|sqlite-vec|vec_distance_cosine/.test(c)) hasVec = true;
      if (/fts5|MATCH\s+\?|bm25\(/i.test(c)) hasFts = true;
    }
  }
};
walk(dir);
if (hasVec && hasFts) {
  console.log("OK: vec0 + FTS5 hybrid present");
  process.exit(0);
}
console.error(`FAIL: vec0=${hasVec}, fts5=${hasFts}`);
process.exit(1);
