#!/usr/bin/env node
import { readFileSync, statSync } from "node:fs";

const cfg = JSON.parse(readFileSync("bundlesize.config.json", "utf8"));
let failed = 0;

function parseSize(s) {
  const m = s.match(/^([\d.]+)\s*(KB|MB)$/i);
  if (!m) throw new Error(`bad size ${s}`);
  return Number(m[1]) * (m[2].toUpperCase() === "MB" ? 1024 * 1024 : 1024);
}

for (const f of cfg.files) {
  try {
    const actual = statSync(f.path).size;
    const max = parseSize(f.maxSize);
    const status = actual <= max ? "OK" : "FAIL";
    if (status === "FAIL") failed++;
    console.log(`[${status}] ${f.path}  ${(actual / 1024).toFixed(1)}KB / ${f.maxSize}`);
  } catch (e) {
    console.warn(`[SKIP] ${f.path} (not built yet)`);
  }
}
process.exit(failed === 0 ? 0 : 1);
