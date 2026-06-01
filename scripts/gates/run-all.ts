#!/usr/bin/env tsx

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import consola from "consola";

const gatesDir = new URL(".", import.meta.url).pathname;
const gateFiles = readdirSync(gatesDir)
  .filter((f) => f.startsWith("G") && f.endsWith(".ts"))
  .sort();

consola.start(`Running ${gateFiles.length} charter gates...\n`);

let passed = 0;
let failed = 0;

for (const file of gateFiles) {
  try {
    consola.info(`Running ${file}...`);
    execSync(`tsx ${join(gatesDir, file)}`, { stdio: "inherit", encoding: "utf-8" });
    consola.success(`${file}: PASS`);
    passed++;
  } catch {
    consola.error(`${file}: FAIL`);
    failed++;
  }
  consola.info("");
}

consola.info("=".repeat(50));
consola.info(`Total: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
