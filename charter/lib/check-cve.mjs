#!/usr/bin/env node
// Filter pnpm audit JSON for high/critical only; ignore --json exit-code quirk.
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm", ["audit", "--json"], { encoding: "utf8" });
let json;
try {
  json = JSON.parse(r.stdout);
} catch {
  console.error("Failed to parse pnpm audit output");
  process.exit(1);
}

const advisories = Object.values(json.advisories ?? {});
const bad = advisories.filter(
  (a) => a.severity === "high" || a.severity === "critical",
);

if (bad.length === 0) {
  console.log("OK: 0 high/critical vulnerabilities");
  process.exit(0);
} else {
  console.error(`FAIL: ${bad.length} high/critical vulnerabilities`);
  for (const a of bad) console.error(`  - ${a.severity}: ${a.module_name} (${a.title})`);
  process.exit(1);
}
