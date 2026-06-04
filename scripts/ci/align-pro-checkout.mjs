#!/usr/bin/env node
/**
 * Aligns Orqenix-Pro checkout style across all workflows.
 *
 * Replaces:
 *   - name: Checkout Orqenix-Pro
 *     env:
 *       PRO_TOKEN: ${{ secrets.ORQENIX_COORDINATOR_PAT }}
 *     run: git clone --depth 1 --branch <ref> https://x-access-token:${PRO_TOKEN}@github.com/milosaysyolo/Orqenix-Pro.git ../Orqenix-Pro
 *
 * With:
 *   - name: Resolve Pro ref
 *     id: pro-ref-<n>
 *     run: echo "ref=$(node scripts/ci/get-pro-ref.mjs)" >> "$GITHUB_OUTPUT"
 *
 *   - name: Checkout Orqenix-Pro
 *     uses: actions/checkout@v4
 *     with:
 *       repository: milosaysyolo/Orqenix-Pro
 *       ref: ${{ steps.pro-ref-<n>.outputs.ref }}
 *       token: ${{ secrets.ORQENIX_COORDINATOR_PAT }}
 *       path: ../Orqenix-Pro
 *       fetch-depth: 1
 *
 * Usage: node scripts/ci/align-pro-checkout.mjs
 *
 * Backs up original workflows to .orqenix/backups/workflows/ before modifying.
 * Idempotent: skips files that already use actions/checkout for Pro.
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

if (!existsSync(WORKFLOWS_DIR)) {
  console.error(`ERROR: ${WORKFLOWS_DIR} not found. Run from repo root.`);
  process.exit(1);
}

mkdirSync(BACKUP_DIR, { recursive: true });

const files = readdirSync(WORKFLOWS_DIR)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .map((f) => join(WORKFLOWS_DIR, f));

const results = [];

// Match the git clone block from ci-repair-report
// Captures the ref so we can preserve override intent if needed
const GIT_CLONE_RE =
  /-\s*name:\s*Checkout Orqenix-Pro\s*\n\s*shell:\s*bash\s*\n\s*env:\s*\n\s*PRO_TOKEN:\s*\$\{\{\s*secrets\.ORQENIX_COORDINATOR_PAT\s*\}\}\s*\n\s*run:\s*git clone[^\n]*--branch\s+(\S+)[^\n]*Orqenix-Pro\.git\s+([^\s\n]+)/g;

// Also match the baseline variant (no shell: bash)
const GIT_CLONE_RE_V2 =
  /-\s*name:\s*Checkout Orqenix-Pro\s*\n\s*env:\s*\n\s*PRO_TOKEN:\s*\$\{\{\s*secrets\.ORQENIX_COORDINATOR_PAT\s*\}\}\s*\n\s*run:\s*git clone[^\n]*--branch\s+(\S+)[^\n]*Orqenix-Pro\.git\s+([^\s\n]+)/g;

let stepCounter = 0;

for (const file of files) {
  const original = readFileSync(file, "utf8");

  const hasPattern1 = GIT_CLONE_RE.test(original);
  GIT_CLONE_RE.lastIndex = 0;
  const hasPattern2 = GIT_CLONE_RE_V2.test(original);
  GIT_CLONE_RE_V2.lastIndex = 0;

  if (!hasPattern1 && !hasPattern2) {
    results.push({ file, action: "skipped", reason: "no git clone Pro pattern" });
    continue;
  }

  if (/uses:\s*actions\/checkout@v4[\s\S]*?repository:\s*milosaysyolo\/Orqenix-Pro/.test(original)) {
    results.push({ file, action: "skipped", reason: "already uses actions/checkout for Pro" });
    continue;
  }

  // Backup
  const backupPath = join(BACKUP_DIR, basename(file) + ".bak." + Date.now());
  writeFileSync(backupPath, original);

  // Replace both patterns
  const replacer = (match, ref, path) => {
    stepCounter += 1;
    const stepId = `pro-ref-${stepCounter}`;
    const indent = "      ";
    return [
      `${indent}- name: Resolve Pro ref`,
      `${indent}  id: ${stepId}`,
      `${indent}  run: echo "ref=$(node scripts/ci/get-pro-ref.mjs)" >> "$GITHUB_OUTPUT"`,
      ``,
      `${indent}- name: Checkout Orqenix-Pro`,
      `${indent}  uses: actions/checkout@v4`,
      `${indent}  with:`,
      `${indent}    repository: milosaysyolo/Orqenix-Pro`,
      `${indent}    ref: \${{ steps.${stepId}.outputs.ref }}`,
      `${indent}    token: \${{ secrets.ORQENIX_COORDINATOR_PAT }}`,
      `${indent}    path: ${path.startsWith("..") ? path : "../Orqenix-Pro"}`,
      `${indent}    fetch-depth: 1`,
    ].join("\n");
  };

  let patched = original;
  if (hasPattern1) {
    patched = patched.replace(GIT_CLONE_RE, replacer);
  }
  if (hasPattern2) {
    GIT_CLONE_RE_V2.lastIndex = 0;
    patched = patched.replace(GIT_CLONE_RE_V2, replacer);
  }

  writeFileSync(file, patched);
  results.push({
    file,
    action: "patched",
    backup: backupPath,
    detectedOriginalRef: "see backup",
  });
}

console.log(JSON.stringify({ results, total_patched: results.filter((r) => r.action === "patched").length }, null, 2));
