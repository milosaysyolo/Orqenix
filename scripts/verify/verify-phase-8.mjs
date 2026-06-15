// SPDX-License-Identifier: Apache-2.0
// Master Phase 8 verification orchestrator.
// Runs, in order, across the OSS workspace:
//   0. dep-version sanity   (check-dep-versions.mjs)
//   1. workspace integrity  (all expected packages present)
//   2. pnpm install         (resolve + link)
//   3. typecheck            (tsc --noEmit per package)
//   4. lint                 (eslint, non-fatal warnings)
//   5. test                 (vitest run per package)
//   6. build                (tsup / next build per package)
//   7. stub-wiring check    (D8.α.6 wired stubs are real, not placeholder)
// Writes verify-report.json + prints a PASS/FAIL matrix.
//
// Usage:
//   node scripts/verify/verify-phase-8.mjs            # full
//   node scripts/verify/verify-phase-8.mjs --no-build # skip build (faster)
//   node scripts/verify/verify-phase-8.mjs --only=typecheck,test

import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const noBuild = args.includes('--no-build');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.split('=')[1].split(',') : null;

// ── Expected Phase 8 OSS packages (566-file scope). Build order matters:
//    leaf packages (no workspace deps) first, then dependents.
const EXPECTED_PACKAGES = [
  // Leaf / foundation
  '@orqenix/ui-primitives',
  '@orqenix/plugin-core',
  '@orqenix/memory-engine',
  '@orqenix/settings-registry',
  '@orqenix/csf',                       // if separate; else part of plugin-core
  // Depend on foundation
  '@orqenix/local-memory-federation',
  '@orqenix/skill-runtime',
  '@orqenix/binding-core',
  '@orqenix/mcp-server',
  '@orqenix/normalization-engine',
  '@orqenix/input-adapters',
  '@orqenix/output-adapters',
  '@orqenix/marketplace-core',
  '@orqenix/marketplace-ui',
  '@orqenix/migration-phase-7-to-8',
  // Self-learning
  '@orqenix/self-learning-observer',
  '@orqenix/self-learning-detection',
  '@orqenix/skill-genesis',
  '@orqenix/instinct-promoter',
  '@orqenix/verification-loop',
  // 7 bindings
  '@orqenix/binding-claude-code',
  '@orqenix/binding-cursor',
  '@orqenix/binding-codex',
  '@orqenix/binding-opencode',
  '@orqenix/binding-cline',
  '@orqenix/binding-aider',
  '@orqenix/binding-continue',
  // App
  '@orqenix/workbench',
];

const steps = [];
function log(msg) {
  process.stdout.write(msg + '\n');
}
function section(title) {
  log('\n' + '═'.repeat(70) + '\n  ' + title + '\n' + '═'.repeat(70));
}
function shouldRun(name) {
  return !only || only.includes(name);
}

/** Runs a pnpm recursive command; returns {ok, durationMs, output} */
function pnpmRun(label, pnpmArgs, { fatal = true } = {}) {
  const start = Date.now();
  log(`\n▶ ${label}: pnpm ${pnpmArgs.join(' ')}`);
  const res = spawnSync('pnpm', pnpmArgs, { cwd: ROOT, encoding: 'utf-8', stdio: 'inherit', shell: process.platform === 'win32' });
  const durationMs = Date.now() - start;
  const ok = res.status === 0;
  steps.push({ label, ok, durationMs, fatal });
  if (!ok && fatal) {
    log(`✗ ${label} FAILED (exit ${res.status}). Stopping (fatal step).`);
  } else {
    log(`${ok ? '✓' : '⚠'} ${label} ${ok ? 'passed' : 'failed (non-fatal)'} in ${(durationMs / 1000).toFixed(1)}s`);
  }
  return { ok, durationMs };
}

// ── Step 0: dependency version sanity ────────────────────────────────────
if (shouldRun('dep-versions')) {
  section('STEP 0: Dependency version sanity (golden rule)');
  const r = spawnSync('node', ['scripts/verify/check-dep-versions.mjs'], { cwd: ROOT, stdio: 'inherit', encoding: 'utf-8' });
  steps.push({ label: 'dep-version-sanity', ok: r.status === 0, fatal: true });
  if (r.status !== 0) {
    log('✗ Dependency version violations found. Fix before continuing.');
    writeReport();
    process.exit(1);
  }
}

// ── Step 1: workspace integrity ───────────────────────────────────────────
if (shouldRun('workspace')) {
  section('STEP 1: Workspace integrity');
  let listed = [];
  try {
    const out = execSync('pnpm -r list --depth -1 --json', { cwd: ROOT, encoding: 'utf-8' });
    listed = JSON.parse(out).map((p) => p.name).filter(Boolean);
  } catch (e) {
    log('⚠ Could not enumerate workspace packages via pnpm. Is pnpm-workspace.yaml present?');
  }
  const missing = EXPECTED_PACKAGES.filter((p) => !listed.includes(p) && p !== '@orqenix/csf');
  if (missing.length > 0) {
    log('⚠ Expected packages NOT found in workspace:\n  - ' + missing.join('\n  - '));
    log('  (If a package was intentionally merged, update EXPECTED_PACKAGES.)');
  } else {
    log(`✓ All expected packages present (${listed.length} total).`);
  }
  steps.push({ label: 'workspace-integrity', ok: missing.length === 0, fatal: false, missing });
}

// ── Step 2: install ───────────────────────────────────────────────────────
if (shouldRun('install')) {
  section('STEP 2: Install (pnpm install)');
  // Use --frozen-lockfile=false on first run since lockfile may not exist yet
  const lockExists = existsSync(join(ROOT, 'pnpm-lock.yaml'));
  const installArgs = lockExists ? ['install', '--prefer-frozen-lockfile'] : ['install'];
  const r = pnpmRun('install', installArgs);
  if (!r.ok) { writeReport(); process.exit(1); }
}

// ── Step 3: typecheck ──────────────────────────────────────────────────────
if (shouldRun('typecheck')) {
  section('STEP 3: Typecheck (tsc --noEmit, all packages)');
  const r = pnpmRun('typecheck', ['-r', '--workspace-concurrency=4', 'run', 'typecheck']);
  if (!r.ok) { log('  → Inspect the package(s) above. Common: missing type, unwired stub, import path.'); }
}

// ── Step 4: lint (non-fatal) ───────────────────────────────────────────────
if (shouldRun('lint')) {
  section('STEP 4: Lint (eslint, non-fatal)');
  pnpmRun('lint', ['-r', 'run', 'lint'], { fatal: false });
}

// ── Step 5: test ───────────────────────────────────────────────────────────
if (shouldRun('test')) {
  section('STEP 5: Test (vitest run, all packages)');
  pnpmRun('test', ['-r', '--workspace-concurrency=2', 'run', 'test']);
}

// ── Step 6: build ──────────────────────────────────────────────────────────
if (shouldRun('build') && !noBuild) {
  section('STEP 6: Build (tsup / next build, all packages)');
  pnpmRun('build', ['-r', 'run', 'build']);
}

// ── Step 7: stub-wiring check ──────────────────────────────────────────────
if (shouldRun('stubs')) {
  section('STEP 7: Stub-wiring check (D8.α.6 wired stubs are real)');
  const r = spawnSync('node', ['scripts/verify/check-stub-wiring.mjs'], { cwd: ROOT, stdio: 'inherit', encoding: 'utf-8' });
  steps.push({ label: 'stub-wiring', ok: r.status === 0, fatal: false });
}

// ── Report ──────────────────────────────────────────────────────────────────
function writeReport() {
  const report = {
    timestamp: new Date().toISOString(),
    root: ROOT,
    steps,
    summary: {
      total: steps.length,
      passed: steps.filter((s) => s.ok).length,
      failed: steps.filter((s) => !s.ok).length,
      fatalFailures: steps.filter((s) => !s.ok && s.fatal).length,
    },
  };
  writeFileSync(join(ROOT, 'verify-report.json'), JSON.stringify(report, null, 2));
  return report;
}

section('VERIFICATION SUMMARY');
const report = writeReport();
for (const s of steps) {
  log(`  ${s.ok ? '✅' : (s.fatal ? '❌' : '⚠️ ')} ${s.label}${s.durationMs ? ` (${(s.durationMs / 1000).toFixed(1)}s)` : ''}`);
}
log(`\n  ${report.summary.passed}/${report.summary.total} steps passed. Report: verify-report.json`);
process.exit(report.summary.fatalFailures > 0 ? 1 : 0);
