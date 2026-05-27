#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, "../check-bundlesize.ts");

const r = spawnSync("node", ["--import", "tsx", target, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
