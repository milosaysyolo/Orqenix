#!/usr/bin/env node
// Integration smoke for the built CLI binary using REAL Phase 5 commands.
// Complements G17/G18 gate runners (which test library APIs directly).
// Verifies the CLI binary builds, dispatches known commands, and rejects
// unknown ones. Exits 0 if all checks pass, 1 otherwise.
import { execFileSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(process.cwd(), "packages/cli/dist/bin.js");

if (!existsSync(CLI)) {
  console.error(`CLI binary not found at ${CLI}. Run 'pnpm --filter @orqenix/cli build' first.`);
  process.exit(1);
}

function run(args, cwd) {
  try {
    const out = execFileSync("node", [CLI, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}

const tmp = mkdtempSync(join(tmpdir(), "orqenix-cli-smoke-"));
let pass = 0;
let fail = 0;

// Each check: [name, argv, predicate(result) => boolean]
const checks = [
  ["version reports 0.5.0-phase-5", ["version"], (r) => r.ok && /0\.5\.0-phase-5/.test(r.out)],
  ["scope init --name", ["scope", "init", "--name=smoke"], (r) => r.ok],
  ["scope info", ["scope", "info"], (r) => r.ok],
  ["link create --remote", ["link", "create", "--remote=scope:test"], (r) => r.ok],
  ["link list", ["link", "list"], (r) => r.ok],
  ["audit verify", ["audit", "verify"], (r) => r.ok],
  ["detach plan --kind full-detach", ["detach", "plan", "--kind=full-detach"], (r) => r.ok],
  ["unknown command rejected", ["bogus", "cmd"], (r) => !r.ok],
];

for (const [name, args, predicate] of checks) {
  const r = run(args, tmp);
  if (predicate(r)) {
    console.log(`  PASS ${name}`);
    pass++;
  } else {
    console.log(`  FAIL ${name}`);
    console.log(
      r.out
        .split("\n")
        .slice(0, 3)
        .map((l) => `       ${l}`)
        .join("\n"),
    );
    fail++;
  }
}

console.log(`CLI surface smoke: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
