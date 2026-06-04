#!/usr/bin/env node
/**
 * Aligns Orqenix-Pro checkout across all workflows to use the
 * composite action .github/actions/checkout-orqenix-repo.
 *
 * Detects 3 legacy patterns and replaces them with the composite call:
 *
 * Pattern A (git clone with hard-coded ref):
 *   - name: Checkout Orqenix-Pro
 *     env:
 *       PRO_TOKEN: ${{ secrets.ORQENIX_COORDINATOR_PAT }}
 *     run: git clone --depth 1 --branch v0.5.0-phase-5 https://...
 *
 * Pattern B (git clone with get-pro-ref.mjs):
 *   - name: Resolve Pro ref ...
 *   - name: Checkout Orqenix-Pro
 *     run: git clone --depth 1 --branch "${{ steps.pro-ref-N.outputs.ref }}" ...
 *
 * Pattern C (actions/checkout@v4 with path: ../Orqenix-Pro, INVALID):
 *   - name: Checkout Orqenix-Pro
 *     uses: actions/checkout@v4
 *     with:
 *       repository: milosaysyolo/Orqenix-Pro
 *       path: ../Orqenix-Pro
 *
 * Replacement: composite action call.
 *
 * Usage: node scripts/ci/align-pro-checkout.mjs
 * Idempotent: skips files already using the composite action.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join, basename } from "node:path";

const WORKFLOWS_DIR = ".github/workflows";
const BACKUP_DIR = ".orqenix/backups/workflows";
const ACTION_PATH = "./.github/actions/checkout-orqenix-repo";

if (!existsSync(WORKFLOWS_DIR)) {
  console.error(`ERROR: ${WORKFLOWS_DIR} not found. Run from repo root.`);
  process.exit(1);
}

if (!existsSync(`${ACTION_PATH}/action.yml`)) {
  console.error(`ERROR: composite action not found at ${ACTION_PATH}/action.yml`);
  console.error("Create the composite action first (Part 2 of deliverable).");
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

const files = readdirSync(WORKFLOWS_DIR)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .map((f) => join(WORKFLOWS_DIR, f));

const COMPOSITE_BLOCK = (indent) =>
  [
    `- name: Checkout Orqenix-Pro (sibling)`,
    `${indent}uses: ./.github/actions/checkout-orqenix-repo`,
    `${indent}with:`,
    `${indent}  scope: pro`,
    `${indent}  layout: sibling`,
    `${indent}  path: ../Orqenix-Pro`,
    `${indent}  token: \${{ secrets.ORQENIX_COORDINATOR_PAT }}`,
    `${indent}  fetch-depth: 1`,
    `${indent}  verify-paths: |`,
    `${indent}    packages/license`,
  ].join("\n");

const PATTERN_A =
  /-\s*name:\s*Checkout Orqenix-Pro\s*\n\s*env:\s*\n\s*PRO_TOKEN:\s*\$\{\{\s*secrets\.ORQENIX_COORDINATOR_PAT\s*\}\}\s*\n\s*run:\s*git clone[^\n]*\n/g;

const PATTERN_B =
  /-\s*name:\s*Resolve Pro ref[\s\S]*?-\s*name:\s*Checkout Orqenix-Pro[\s\S]*?(?=\n\s*-\s|\n\s*\w+:|\Z)/g;

const PATTERN_C =
  /-\s*name:\s*Checkout Orqenix-Pro\s*\n\s*uses:\s*actions\/checkout@v4\s*\n\s*with:\s*\n\s*repository:\s*milosaysyolo\/Orqenix-Pro[\s\S]*?path:\s*\.\.\/Orqenix-Pro[\s\S]*?(?=\n\s*-\s|\n\s*\w+:|\Z)/g;

const PATTERN_COMPOSITE_ALREADY =
  /uses:\s*\.\/\.github\/actions\/checkout-orqenix-repo/g;

const results = [];

for (const file of files) {
  const original = readFileSync(file, "utf8");

  if (PATTERN_COMPOSITE_ALREADY.test(original)) {
    results.push({ file, action: "skipped", reason: "already uses composite action" });
    PATTERN_COMPOSITE_ALREADY.lastIndex = 0;
    continue;
  }

  let modified = original;
  let patternsMatched = [];

  for (const [name, regex] of [
    ["A", PATTERN_A],
    ["B", PATTERN_B],
    ["C", PATTERN_C],
  ]) {
    if (regex.test(modified)) {
      regex.lastIndex = 0;
      modified = modified.replace(regex, (match) => {
        const indentMatch = match.match(/^(\s*)-\s/);
        const baseIndent = indentMatch ? indentMatch[1] : "      ";
        const innerIndent = baseIndent + "  ";
        return COMPOSITE_BLOCK(innerIndent);
      });
      patternsMatched.push(name);
    }
  }

  if (patternsMatched.length === 0) {
    results.push({ file, action: "skipped", reason: "no legacy pattern matched" });
    continue;
  }

  const backupPath = join(
    BACKUP_DIR,
    basename(file) + ".bak." + Date.now() + ".pre-composite",
  );
  writeFileSync(backupPath, original);
  writeFileSync(file, modified);
  results.push({
    file,
    action: "patched",
    patternsMatched,
    backup: backupPath,
  });
}

const summary = {
  total_files: files.length,
  patched: results.filter((r) => r.action === "patched").length,
  skipped: results.filter((r) => r.action === "skipped").length,
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (summary.patched === 0) {
  console.error("\nNo files patched. Either all workflows already use the composite action, or the regex patterns need adjustment for your actual workflow content. Inspect manually:");
  console.error("  grep -l 'Orqenix-Pro' .github/workflows/*.yml");
}
