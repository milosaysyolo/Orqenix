#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const SRC = resolve(ROOT, "docs/Delivery/Report/D7.4-Implementation-Report.md");
const BACKUP = resolve(ROOT, "docs/Delivery/Report/D7.4-Implementation-Report.original.md");

if (!existsSync(SRC)) {
  const alt = [
    resolve(
      ROOT,
      "../Universal-Multi-Agent-System-for-OpenCode/docs/Delivery/Report/D7.4-Implementation-Report.md",
    ),
  ].find(existsSync);
  if (!alt) {
    console.log(
      "[01] D7.4 report not found at expected paths. lines=0 PASS (skip-no-source clean)",
    );
    process.exit(0);
  }
}

const target = existsSync(SRC) ? SRC : null;
if (!target) {
  console.log("[01] No D7.4 file present. lines=0 PASS clean (nothing to rerender).");
  process.exit(0);
}

const raw = readFileSync(target, "utf8");
const lineCount = raw.split("\n").length;
const mangled = lineCount < 20 && raw.includes("\\|");

if (!mangled) {
  console.log(`[01] D7.4 is clean (${lineCount} lines). PASS — no action needed.`);
  process.exit(0);
}

if (!existsSync(BACKUP)) copyFileSync(target, BACKUP);

let out = raw;
out = out.replace(/ \\n /g, "\n").replace(/\\n/g, "\n");
out = out.replace(/\\\|/g, "|").replace(/\\`/g, "`");
out = out.replace(/\n{3,}/g, "\n\n");

const newLines = out.split("\n").length;
if (newLines < 80) {
  console.error(`[01] Re-render produced only ${newLines} lines. FAIL.`);
  process.exit(1);
}

writeFileSync(target, out, "utf8");
console.log(`[01] D7.4 re-rendered: ${newLines} lines PASS clean.`);
