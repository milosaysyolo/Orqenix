#!/usr/bin/env node
// Integration smoke for the built CLI binary using REAL Phase 5 commands.
// Complements G17/G18 gate runners (which test library APIs directly).
//
// The CLI (packages/cli/src/bin.ts) resolves its SQLite DB at
// ORQENIX_DB ?? <cwd>/.orqenix/kb.sqlite. better-sqlite3 creates the .sqlite
// file but NOT the parent .orqenix/ directory, so we create it before running
// DB-backed commands (link/audit/detach).
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, existsSync, readFileSync } from "node:fs";
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
      env: {
        ...process.env,
        ORQENIX_ROOT: cwd,
        ORQENIX_SCOPE: "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}

const tmp = mkdtempSync(join(tmpdir(), "orqenix-cli-smoke-"));
// CLI expects <cwd>/.orqenix/kb.sqlite; better-sqlite3 won't create the dir.
mkdirSync(join(tmp, ".orqenix"), { recursive: true });

let pass = 0;
let fail = 0;

// Each check: [name, argv, predicate(result) => boolean]
const expectedVersion = JSON.parse(
  readFileSync(join(process.cwd(), "packages/cli/package.json"), "utf8"),
).version;
const checks = [
  [
    `version reports ${expectedVersion}`,
    ["version"],
    (r) => r.ok && new RegExp(expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(r.out),
  ],
  ["scope init --name", ["scope", "init", "--name=smoke"], (r) => r.ok],
  ["scope info", ["scope", "info"], (r) => r.ok],
  [
    "link create --remote",
    ["link", "create", "--remote=scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
    (r) => r.ok,
  ],
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
