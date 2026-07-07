// scripts/gates/G41-native-matrix.ts
/**
 * Charter Gate G41: Native Binding CI Matrix.
 * Asserts the 5 criteria from CR v7.2 Chapter 8.9 programmatically.
 *
 * Strategy:
 *   1. Parse the workflow YAML and inspect the matrix shape.
 *   2. Assert exact counts and tier annotations.
 *   3. Assert action versions.
 *   4. Run the smoke script locally (unless SKIP_LOCAL_SMOKE=1).
 *
 * Exits non-zero on any failure.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const WORKFLOW_PATH = join(ROOT, ".github", "workflows", "native-matrix.yml");
const SMOKE_PATH = join(ROOT, "scripts", "ci", "native-matrix", "smoke.mjs");
const FIXTURE_PATH = join(ROOT, "scripts", "ci", "native-matrix", "fixtures", "blake3-known.json");

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`[G41] ${tag}  ${name}${detail ? `  (${detail})` : ""}`);
}

interface MatrixEntry {
  tier?: number;
  os_label?: string;
  runner?: string;
  node?: number;
}

interface WorkflowShape {
  jobs?: {
    [k: string]: {
      strategy?: { matrix?: { include?: MatrixEntry[] } };
      steps?: Array<{ uses?: string; with?: Record<string, unknown> }>;
      "continue-on-error"?: string | boolean;
    };
  };
}

function loadWorkflow(): WorkflowShape {
  const raw = readFileSync(WORKFLOW_PATH, "utf8");
  return parseYaml(raw) as WorkflowShape;
}

async function main(): Promise<void> {
  // ---- C1: workflow parses; matrix has exactly 10 entries ----
  let wf: WorkflowShape;
  try {
    wf = loadWorkflow();
  } catch (e) {
    check("C1 workflow YAML parseable", false, String((e as Error).message));
    process.exit(1);
  }
  const job = wf.jobs?.native;
  const include = job?.strategy?.matrix?.include ?? [];
  check("C1 workflow has native job with matrix.include", !!job && Array.isArray(include));
  check("C1b matrix has 10 total entries", include.length === 10, `got ${include.length}`);

  const tier1 = include.filter((e) => e.tier === 1);
  const tier2 = include.filter((e) => e.tier === 2);

  // ---- C2: Tier-1 has 6 entries, Tier-2 has 4 entries ----
  check("C2a Tier-1 count = 6", tier1.length === 6, `got ${tier1.length}`);
  check("C2b Tier-2 count = 4", tier2.length === 4, `got ${tier2.length}`);

  const expectedTier1: Array<[string, number]> = [
    ["darwin-arm64", 22],
    ["darwin-arm64", 24],
    ["linux-x64-gnu", 22],
    ["linux-x64-gnu", 24],
    ["win32-x64", 22],
    ["win32-x64", 24],
  ];
  const expectedTier2: Array<[string, number]> = [
    ["darwin-x64", 22],
    ["darwin-x64", 24],
    ["linux-arm64-gnu", 22],
    ["linux-arm64-gnu", 24],
  ];
  const t1set = new Set(tier1.map((e) => `${e.os_label}|${e.node}`));
  const t2set = new Set(tier2.map((e) => `${e.os_label}|${e.node}`));
  const t1ok = expectedTier1.every(([os, n]) => t1set.has(`${os}|${n}`));
  const t2ok = expectedTier2.every(([os, n]) => t2set.has(`${os}|${n}`));
  check("C2c Tier-1 entries match the locked OS x Node combos", t1ok);
  check("C2d Tier-2 entries match the locked OS x Node combos", t2ok);

  // ---- C3: continue-on-error: true ONLY for Tier-2 (expressed via matrix.tier == 2) ----
  const coe = String(job?.["continue-on-error"] ?? "");
  check(
    "C3 continue-on-error keyed off matrix.tier == 2",
    coe.includes("matrix.tier == 2"),
    `got: ${coe.slice(0, 80)}`,
  );

  // ---- C4: Node versions across all entries are exactly {22, 24} ----
  const nodes = new Set(
    include.map((e) => e.node).filter((n): n is number => typeof n === "number"),
  );
  check(
    "C4 Node versions are exactly 22 and 24 (no Node 20)",
    nodes.size === 2 && nodes.has(22) && nodes.has(24),
    `got: ${[...nodes].join(",")}`,
  );

  // ---- C5: action versions are pinned (checkout@v4, setup-node@v4, cache@v4, pnpm/action-setup@v4) ----
  const usesList = (job?.steps ?? [])
    .map((s) => s.uses)
    .filter((u): u is string => typeof u === "string");
  const required = [
    "actions/checkout@v4",
    "pnpm/action-setup@v4",
    "actions/setup-node@v4",
    "actions/cache@v4",
  ];
  const allPinned = required.every((r) => usesList.includes(r));
  check("C5a required actions all pinned to v4", allPinned, usesList.join(", "));

  // Verify the smoke step is present and uses the expected path.
  const smokeStep = (job?.steps ?? []).find((s) => {
    const run = (s as { run?: string }).run ?? "";
    return run.includes("scripts/ci/native-matrix/smoke.mjs");
  });
  check("C5b smoke step references scripts/ci/native-matrix/smoke.mjs", !!smokeStep);

  // ---- Local smoke (run unless explicitly skipped) ----
  if (process.env.SKIP_LOCAL_SMOKE === "1") {
    console.log("[G41] SKIP  local smoke (SKIP_LOCAL_SMOKE=1)");
  } else {
    // Sanity: fixture file must not still contain the placeholder.
    let fixtureOk = true;
    try {
      const fx = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
      if (typeof fx.expected_hex !== "string" || !/^[0-9a-f]{64}$/.test(fx.expected_hex)) {
        fixtureOk = false;
      }
    } catch {
      fixtureOk = false;
    }
    check("C5c blake3-wasm fixture has a real 64-hex digest", fixtureOk, `path: ${FIXTURE_PATH}`);

    if (fixtureOk) {
      const r = spawnSync(process.execPath, ["--experimental-vm-modules", SMOKE_PATH], {
        stdio: "inherit",
      });
      check("C5d local smoke exits 0", r.status === 0, `status=${r.status}`);
    }
  }

  if (failures > 0) {
    console.error(`[G41] ${failures} criterion failures`);
    process.exit(1);
  }
  console.log("[G41] ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
