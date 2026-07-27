#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const SRC = resolve(
  ROOT,
  "../Universal-Multi-Agent-System-for-OpenCode/docs/Delivery/Report/D7.4-Implementation-Report.md",
);

if (!existsSync(SRC)) {
  console.error(`[01] Source not found: ${SRC}`);
  process.exit(1);
}

const raw = readFileSync(SRC, "utf8");
const mangled = raw.split("\n").length < 20 && raw.includes("\\|");
if (!mangled) {
  console.log("[01] D7.4 already clean. No action.");
  process.exit(0);
}

let out = raw;
out = out.replace(/ \\n /g, "\n");
out = out.replace(/\\n/g, "\n");
out = out.replace(/\\\|/g, "|");
out = out.replace(/\\`/g, "`");
out = out.replace(/\n{3,}/g, "\n\n");

const lineCount = out.split("\n").length;
if (lineCount < 80) {
  console.error(`[01] Re-render produced only ${lineCount} lines. Likely incomplete.`);
  process.exit(1);
}

writeFileSync(SRC, out, "utf8");
console.log(`[01] D7.4 re-rendered: ${lineCount} lines. PASS.`);
process.exit(0);
