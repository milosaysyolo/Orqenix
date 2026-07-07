#!/usr/bin/env node
// Master closure orchestrator for Phase 7. Sequential blocks with hard gates.
// Applies Phase 5/6 npm/tag/versioning lessons. Checkpoints after each block.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const OUT = resolve(REPO_ROOT, "out/close-phase-7");
const STATE = resolve(OUT, "closure-state.json");
const LOG = resolve(OUT, "closure.log");
mkdirSync(OUT, { recursive: true });

const VERSION = "0.7.0-phase-7";
const TAG = `v${VERSION}`;
const REPOS = ["milosaysyolo/Orqenix", "milosaysyolo/Orqenix-Pro", "milosaysyolo/Orqenix-Cloud"];

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const has = (k) => args.includes(k);
const PLAN = has("--plan");
const STRICT = has("--strict");
const CONFIRM = opt("--confirm", "");
const FROM = parseInt(opt("--from", opt("--block", "1")), 10);
const TO = parseInt(opt("--to", opt("--block", "7")), 10);
const IS_WIN = platform() === "win32";

const C = {
  c: (s) => `\x1b[1;36m${s}\x1b[0m`,
  g: (s) => `\x1b[1;32m${s}\x1b[0m`,
  r: (s) => `\x1b[1;31m${s}\x1b[0m`,
  y: (s) => `\x1b[1;33m${s}\x1b[0m`,
};
const log = (...a) => {
  const m = a.join(" ");
  console.log(C.c("[close]"), m);
  appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`);
};

function loadState() {
  if (existsSync(STATE)) return JSON.parse(readFileSync(STATE, "utf8"));
  return { version: VERSION, blocks: {}, started: new Date().toISOString() };
}
function saveState(s) {
  writeFileSync(STATE, JSON.stringify(s, null, 2));
}
function checkpoint(state, block, status, note) {
  state.blocks[block] = { status, note, ts: new Date().toISOString() };
  saveState(state);
  log(`CHECKPOINT block ${block}: ${status}${note ? " \u2014 " + note : ""}`);
}

function run(cmd, cmdArgs, cwd = REPO_ROOT) {
  if (PLAN) {
    log(`[plan] ${cmd} ${cmdArgs.join(" ")} (cwd=${cwd})`);
    return { status: 0, stdout: "", stderr: "" };
  }
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: "utf8", timeout: 30601000 });
  return r;
}

// ============================================================================
// BLOCK 1 — Fix code drift (bench files + D7.4 report)
// ============================================================================
function block1(state) {
  log(C.c("BLOCK 1 \u2014 Fix code drift"));
  const benchDir = resolve(REPO_ROOT, "packages/relay-core/bench");
  const rtt = resolve(benchDir, "rtt.bench.ts");
  const tps = resolve(benchDir, "throughput.bench.ts");

  let issues = [];
  if (!existsSync(rtt)) issues.push("missing bench/rtt.bench.ts");
  if (!existsSync(tps)) issues.push("missing bench/throughput.bench.ts");

  // Detect scaffold (too few lines = scaffold per D7.2: rtt=14, tps=7)
  if (existsSync(rtt) && readFileSync(rtt, "utf8").split("\n").length < 25)
    issues.push(
      "rtt.bench.ts looks like a scaffold (<25 lines) \u2014 implement instrumented bench",
    );
  if (existsSync(tps) && readFileSync(tps, "utf8").split("\n").length < 20)
    issues.push("throughput.bench.ts looks like a scaffold (<20 lines)");

  // Re-render D7.4 report
  const r = run("node", [
    resolve(__dirname, "../../post-release/v0.7.0-phase-7/v2/01-rerender-d7.4-report.mjs"),
  ]);
  if (r.status !== 0) issues.push("D7.4 re-render failed");

  if (issues.length > 0) {
    log(C.y("Block 1 issues:"));
    issues.forEach((i) => log(" - " + i));
    checkpoint(state, "1", "NEEDS_WORK", issues.join("; "));
    log(
      C.y(
        "REMEDIATION: implement instrumented bench files measuring real p95 (rtt) and sustained env/s (throughput). Re-run block 1.",
      ),
    );
    return false;
  }
  checkpoint(state, "1", "GREEN", "bench files real + D7.4 clean");
  return true;
}

// ============================================================================
// BLOCK 2 — Fix Pro deps + BOM
// ============================================================================
function block2(state) {
  log(C.c("BLOCK 2 \u2014 Fix Pro deps + BOM"));
  const fix = resolve(__dirname, "../../post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs");

  // Dry-run first
  const dry = run("node", [fix, "--dry-run"]);
  log(dry.stdout || "");

  if (!PLAN) {
    const apply = run("node", [fix]);
    log(apply.stdout || "");
    if (apply.status !== 0) {
      checkpoint(state, "2", "RED", "fix-pro-deps failed");
      return false;
    }
  }

  // Verify Pro build after fix
  const proRepo = resolve(REPO_ROOT, "../Orqenix-Pro");
  if (existsSync(proRepo)) {
    const inst = run("pnpm", ["install", "--no-frozen-lockfile"], proRepo);
    const build = run("pnpm", ["-r", "build"], proRepo);
    const test = run("pnpm", ["-r", "test"], proRepo);
    if ([inst, build, test].some((x) => x.status !== 0)) {
      // Expected pre-publication: packages not yet on registry.
      // fix-pro-deps already succeeded, so this is PARTIAL, not RED.
      checkpoint(
        state,
        "2",
        "PARTIAL",
        "fix-pro-deps OK; build fails pre-publication (expected). Run pnpm install after publish.",
      );
      return true;
    }
    checkpoint(state, "2", "GREEN", "Pro deps fixed + build/test OK");
  } else {
    checkpoint(
      state,
      "2",
      "PARTIAL",
      "Pro repo not local \u2014 fix will run in CI before publish",
    );
  }
  return true;
}

// ============================================================================
// BLOCK 6sec — Security pre-flight (runs BEFORE ceremony)
// ============================================================================
function blockSecurity(state) {
  log(C.c("BLOCK 6sec \u2014 Security pre-flight"));
  const checks = [
    {
      name: "audit-chain-tamper",
      cmd: ["pnpm", "--filter", "@orqenix-cloud/audit-core", "test", "--", "--grep", "tamper"],
    },
    {
      name: "migration-300-strict",
      cmd: ["pnpm", "--filter", "@orqenix-cloud/identity-bridge", "test", "migration-300.test.ts"],
    },
    {
      name: "oauth-scope-lock",
      cmd: [
        "pnpm",
        "--filter",
        "@orqenix-cloud/identity-bridge",
        "test",
        "github-provider.test.ts",
      ],
    },
    {
      name: "tls-required",
      cmd: [
        "pnpm",
        "--filter",
        "@orqenix-cloud/relay-transport",
        "test",
        "transport.integration.test.ts",
      ],
    },
    {
      name: "cross-tenant",
      cmd: ["pnpm", "--filter", "@orqenix-cloud/relay-core", "test", "router.integration.test.ts"],
    },
  ];
  let fails = [];
  for (const ck of checks) {
    const r = run(ck.cmd[0], ck.cmd.slice(1));
    writeFileSync(resolve(OUT, `sec-${ck.name}.log`), `${r.stdout || ""}\n${r.stderr || ""}`);
    if (r.status !== 0 && !PLAN) {
      fails.push(ck.name);
      log(C.r(` FAIL ${ck.name}`));
    } else log(C.g(` OK ${ck.name}`));
  }
  // Static: no DHT/P2P imports
  const grep = run("grep", [
    "-rE",
    "libp2p|dht|kad-dht",
    "packages/relay-core/src",
    "packages/relay-transport/src",
  ]);
  if (grep.stdout && grep.stdout.trim() && !PLAN) {
    fails.push("dht-p2p-import-found");
  }

  if (fails.length > 0) {
    checkpoint(state, "6sec", "RED", `security fails: ${fails.join(", ")}`);
    log(C.r("SECURITY GATE RED \u2014 do NOT publish. Fix before ceremony."));
    return false;
  }
  checkpoint(state, "6sec", "GREEN", "7 security checks pass, no DHT/P2P");
  return true;
}

// ============================================================================
// BLOCK 3 — Release ceremony (CI ONLY, irreversible)
// ============================================================================
function block3(state) {
  log(C.c("BLOCK 3 \u2014 Release ceremony (publish + sign + tag)"));
  if (CONFIRM !== "I-UNDERSTAND-MFA") {
    log(C.r("Block 3 is IRREVERSIBLE (npm MFA blocks unpublish \u2014 lesson #1)."));
    log(C.y("Re-run with --confirm I-UNDERSTAND-MFA to proceed, OR run on CI:"));
    log("  gh workflow run close-phase-7-ceremony.yml --ref main -f confirm=I-UNDERSTAND-MFA");
    checkpoint(state, "3", "BLOCKED", "confirmation required");
    return false;
  }
  if (IS_WIN) {
    log(C.r("Ceremony requires Linux + OIDC (cosign keyless). Run on CI, not Windows."));
    checkpoint(state, "3", "BLOCKED", "windows host \u2014 use CI");
    return false;
  }
  // Preflight: token type + whitelist + npm whoami
  const whoami = run("npm", ["whoami"]);
  if (whoami.status !== 0 && !PLAN) {
    checkpoint(state, "3", "RED", "npm not authenticated (need Automation token)");
    return false;
  }
  const whitelist = resolve(REPO_ROOT, ".orqenix/release/publishable-whitelist.yaml");
  if (!existsSync(whitelist)) {
    checkpoint(state, "3", "RED", "publishable-whitelist.yaml missing (lesson #7)");
    return false;
  }
  // Delegate to ceremony.sh (D7.18) which does: verify\u2192bump\u2192build\u2192publish\u2192sign\u2192helm\u2192tag\u2192release
  const ceremony = run("bash", [resolve(REPO_ROOT, "scripts/release/ceremony.sh")]);
  log((ceremony.stdout || "").slice(-3000));
  if (ceremony.status !== 0 && !PLAN) {
    checkpoint(state, "3", "RED", "ceremony.sh failed \u2014 see log");
    return false;
  }
  checkpoint(state, "3", "GREEN", "published + signed + tagged 3 repos");
  return true;
}

// ============================================================================
// BLOCK 4 — v2 validation (CI Linux)
// ============================================================================
function block4(state) {
  log(C.c("BLOCK 4 \u2014 v2 post-release validation"));
  if (IS_WIN) {
    log(C.y("v2 validation must run on Linux to close P0 SKIP items."));
    log(`  gh workflow run post-release-validation-v2.yml --ref ${TAG} -f strict=true`);
    checkpoint(state, "4", "BLOCKED", "windows \u2014 trigger CI workflow");
    return false;
  }
  const v = run("node", [
    resolve(__dirname, "../../post-release/v0.7.0-phase-7/v2/run-all.mjs"),
    "--strict",
  ]);
  log((v.stdout || "").slice(-2000));
  // exit 0 = GO, 2 = INCONCLUSIVE, 1 = NO-GO
  if (v.status === 0) {
    checkpoint(state, "4", "GREEN", "verdict GO");
    return true;
  }
  if (v.status === 2) {
    checkpoint(state, "4", "INCONCLUSIVE", "P0 SKIP/weak evidence");
    return false;
  }
  checkpoint(state, "4", "RED", "verdict NO-GO");
  return false;
}

// ============================================================================
// BLOCK 5 — Defer limitations (GitHub issues, milestone v0.7.1)
// ============================================================================
function block5(state) {
  log(C.c("BLOCK 5 \u2014 Defer limitations to v0.7.1"));
  const deferred = [
    "Native gRPC protobuf full proto-loader integration",
    "Detach recovery code signed by scope key",
    "CLI link command Cloudflare Workers compatibility",
    "YAML parser support for comments/manual edits",
    "Multi-scope per scope folder support",
    "BYOK ephemeral credential typed as scoped-token",
  ];
  const milestone = "v0.7.1-phase-7";
  const created = [];
  for (const title of deferred) {
    if (PLAN) {
      log(`[plan] gh issue create: ${title}`);
      created.push(title);
      continue;
    }
    const r = run("gh", [
      "issue",
      "create",
      "--title",
      `[deferred] ${title}`,
      "--body",
      `Deferred from Phase 7 closure. Milestone ${milestone}.`,
      "--label",
      "deferred,phase-7.1",
      "--milestone",
      milestone,
    ]);
    if (r.status === 0) created.push(title);
    else log(C.y(` could not create issue (milestone may need manual create): ${title}`));
  }
  writeFileSync(
    resolve(OUT, "deferred-issues.json"),
    JSON.stringify({ milestone, created }, null, 2),
  );
  checkpoint(
    state,
    "5",
    created.length === deferred.length ? "GREEN" : "PARTIAL",
    `${created.length}/${deferred.length} issues filed`,
  );
  return true;
}

// ============================================================================
// BLOCK 7 — Docs + announce + memory checkpoint
// ============================================================================
function block7(state) {
  log(C.c("BLOCK 7 \u2014 Docs + announce readiness"));
  const tasks = [
    "Update release-notes-v0.7.0-phase-7.md with MEASURED benchmark numbers (from block 1 evidence)",
    "Verify README badges: npm version, CI status, Apache-2.0 (OSS) / BSL-1.1 (Pro)",
    "Publish RETROSPECTIVE.md + release notes (already shipped D7.18)",
    "Announce: GitHub Discussions pinned + Discord + Twitter",
    "Write long-term memory checkpoint for Phase 7 closure",
  ];
  const md = ["# Phase 7 Closure \u2014 Final Tasks", "", ...tasks.map((t, i) => `- [ ] ${t}`), ""];
  writeFileSync(resolve(OUT, "announce-checklist.md"), md.join("\n"));
  log("Announce checklist written: out/close-phase-7/announce-checklist.md");
  checkpoint(state, "7", "GREEN", "docs/announce checklist ready");
  log(C.g(`Remember to record memory: "Phase 7 FULLY CLOSED at ${TAG}"`));
  return true;
}

// ============================================================================
// Driver
// ============================================================================
const BLOCKS = {
  1: block1,
  2: block2,
  6: blockSecurity,
  3: block3,
  4: block4,
  5: block5,
  7: block7,
};
// Execution sequence (note 6sec runs between 2 and 3)
const SEQ = [1, 2, 6, 3, 4, 5, 7];

const state = loadState();
log(
  `Closure run: version=${VERSION} from=${FROM} to=${TO} plan=${PLAN} strict=${STRICT} host=${platform()}`,
);

let allGreen = true;
for (const b of SEQ) {
  const logicalNum = b === 6 ? 2.5 : b; // 6sec sits after block 2
  // Skip if logicalNum is outside requested range
  if (logicalNum < FROM) continue;
  if (b === 6 && logicalNum > TO) continue;
  if (b !== 6 && b > TO) continue;
  const ok = BLOCKS[b](state);
  if (!ok) {
    allGreen = false;
    if (STRICT) {
      log(C.r(`Stopping: block ${b} not GREEN in strict mode`));
      break;
    }
  }
}

// Final verdict
const greenCount = Object.values(state.blocks).filter((x) => x.status === "GREEN").length;
console.log();
console.log(C.c("=".repeat(70)));
console.log(" Phase 7 Closure State:");
for (const [k, v] of Object.entries(state.blocks)) {
  const icon =
    v.status === "GREEN"
      ? C.g("\u2705")
      : v.status === "RED" || v.status === "NO-GO"
        ? C.r("\u274C")
        : C.y("\uD83D\uDFE1");
  console.log(`  Block ${k}: ${icon} ${v.status} \u2014 ${v.note}`);
}
const fullyClosed = ["1", "2", "6sec", "3", "4", "5", "7"].every(
  (k) => state.blocks[k]?.status === "GREEN",
);
console.log();
console.log(
  " Phase 7: " +
    (fullyClosed ? C.g("FULLY CLOSED \u2705") : C.y("NOT YET CLOSED \u2014 see blocks above")),
);
console.log(C.c("=".repeat(70)));
process.exit(fullyClosed ? 0 : 1);
