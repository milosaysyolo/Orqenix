#!/usr/bin/env node
// Verify CI matrix has 3 OS x 2 Node = 6 jobs, robust to YAML formatting.
import { readFileSync } from "node:fs";
import { parse } from "yaml";

let ci;
try {
  ci = parse(readFileSync(".github/workflows/ci.yml", "utf8"));
} catch (e) {
  console.error(`Failed to parse ci.yml: ${e.message}`);
  process.exit(1);
}

const matrix = ci?.jobs?.test?.strategy?.matrix ?? {};
const os = (matrix.os ?? []).map(String);
const node = (matrix["node-version"] ?? matrix.node ?? []).map(String);

const REQUIRED_OS = ["ubuntu-latest", "macos-latest", "windows-latest"];
const hasAllOS = REQUIRED_OS.every((o) => os.includes(o));
// Node 20 is EOL (deprecated on runners); CI runs 22 and 24.
const has2Node = node.includes("22") && node.includes("24");
const jobCount = os.length * node.length;

console.log(`OS: [${os.join(", ")}], Node: [${node.join(", ")}], Jobs: ${jobCount}`);

if (hasAllOS && has2Node && jobCount === 6) {
  process.exit(0);
}

if (!hasAllOS) console.error(`Missing OS. Required: ${REQUIRED_OS.join(", ")}`);
if (!has2Node) console.error("Missing Node 22 or 24");
if (jobCount !== 6) console.error(`Expected 6 jobs, got ${jobCount}`);
process.exit(1);
