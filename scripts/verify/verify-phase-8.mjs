// SPDX-License-Identifier: Apache-2.0
// verify-phase-8.mjs
// Full verification pipeline for Phase 8 CORE.
// Steps: install → native-bindings → typecheck → lint → test → build → stub-wiring
//
// Run:
//   node scripts/verify/verify-phase-8.mjs                  # full pipeline
//   node scripts/verify/verify-phase-8.mjs --skip-install   # skip install step
//   node scripts/verify/verify-phase-8.mjs --no-build       # skip build step
//   node scripts/verify/verify-phase-8.mjs --phase-8-only   # test only Phase 8 packages

import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const isWin = process.platform === 'win32';

// --skip-X / --no-X flags
const skipInstall = args.includes('--skip-install');
const skipTypecheck = args.includes('--skip-typecheck');
const skipLint = args.includes('--skip-lint');
const noBuild = args.includes('--no-build');
const phase8Only = args.includes('--phase-8-only');
const writeReportFlag = args.includes('--report');

function shouldRun(label) {
  if (label === 'install' && skipInstall) return false;
  if (label === 'typecheck' && skipTypecheck) return false;
  if (label === 'lint' && skipLint) return false;
  if (label === 'build' && noBuild) return false;
  return true;
}

function section(title) {
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(64)}`);
}

function log(msg) {
  console.log(`  ${msg}`);
}

const steps = [];

function writeReport() {
  const allOk = steps.every((s) => s.ok);
  const report = {
    pipeline: 'Phase 8 CORE Verification',
    timestamp: new Date().toISOString(),
    platform: { node: process.version, os: process.platform, arch: process.arch },
    summary: { total: steps.length, passed: steps.filter((s) => s.ok).length, failed: steps.filter((s) => !s.ok).length },
    steps,
    verdict: allOk ? 'PASS' : 'FAIL',
  };
  writeFileSync('verify-report.json', JSON.stringify(report, null, 2));
  log(`Report: verify-report.json`);
}

// ── Step 1: INSTALL ──────────────────────────────────────────────────────
if (shouldRun('install')) {
  section('STEP 1: Install dependencies');
  const r = spawnSync('pnpm', ['install'], {
    cwd: ROOT, stdio: 'inherit', encoding: 'utf-8', shell: isWin,
  });
  steps.push({ label: 'install', ok: r.status === 0, fatal: true });
  if (r.status !== 0) {
    log('✗ Install failed');
    writeReport();
    process.exit(1);
  }
  log('✓ Dependencies installed');
}

// ── Step 1.5: NATIVE BINDINGS ──────────────────────────────────────────
if (shouldRun('native')) {
  section('STEP 1.5: Native bindings (better-sqlite3, esbuild, @swc/core)');
  const r = spawnSync('node', ['scripts/verify/check-native-bindings.mjs', '--auto-rebuild'], {
    cwd: ROOT, stdio: 'inherit', encoding: 'utf-8',
  });
  steps.push({ label: 'native-bindings', ok: r.status === 0, fatal: true });
  if (r.status !== 0) {
    log('✗ Native bindings cannot load. Run `pnpm run rebuild:native` manually, then re-verify.');
    writeReport();
    process.exit(1);
  }
}

// ── Step 2: TYPECHECK ───────────────────────────────────────────────────
if (shouldRun('typecheck')) {
  section('STEP 2: Typecheck');
  const r = spawnSync('pnpm', ['-r', 'run', 'typecheck'], {
    cwd: ROOT, stdio: 'inherit', encoding: 'utf-8', shell: isWin,
    timeout: 300000,
  });
  steps.push({ label: 'typecheck', ok: r.status === 0, fatal: true });
  if (r.status !== 0) {
    log('✗ Typecheck failed');
    writeReport();
    process.exit(1);
  }
  log('✓ Typecheck passed');
}

// ── Step 3: LINT ────────────────────────────────────────────────────────
if (shouldRun('lint')) {
  section('STEP 3: Lint');
  const r = spawnSync('pnpm', ['-r', '--filter="./packages/*"', 'lint'], {
    cwd: ROOT, stdio: 'inherit', encoding: 'utf-8', shell: isWin,
    timeout: 120000,
  });
  steps.push({ label: 'lint', ok: r.status === 0, fatal: false });
  if (r.status !== 0) {
    log('✗ Lint failed (non-fatal for Phase 8 gate)');
  } else {
    log('✓ Lint passed');
  }
}

// ── Step 5: TEST (scoped to Phase 8 by default) ─────────────────────────
if (shouldRun('test')) {
  section('STEP 5: Test (scoped to Phase 8 by default)');
  const testArgs = phase8Only ? ['--phase-8-only', '--report'] : ['--all', '--report'];
  const r = spawnSync('node', ['scripts/verify/test-gate.mjs', ...testArgs], {
    cwd: ROOT, stdio: 'inherit', encoding: 'utf-8',
  });
  steps.push({
    label: phase8Only ? 'test (phase-8 only)' : 'test (all)',
    ok: r.status === 0,
    fatal: phase8Only, // legacy fails are non-fatal
  });
  if (r.status !== 0) {
    log(phase8Only ? '✗ Test gate FAILED (blocking)' : '✗ Some tests failed (non-blocking for legacy)');
  }
}

// ── Step 6: BUILD ───────────────────────────────────────────────────────
if (shouldRun('build')) {
  section('STEP 6: Build');
  const r = spawnSync('pnpm', ['-r', 'run', 'build'], {
    cwd: ROOT, stdio: 'inherit', encoding: 'utf-8', shell: isWin,
    timeout: 600000,
  });
  steps.push({ label: 'build', ok: r.status === 0, fatal: true });
  if (r.status !== 0) {
    log('✗ Build failed');
    writeReport();
    process.exit(1);
  }
  log('✓ Build passed');
}

// ── Step 7: STUB WIRING ────────────────────────────────────────────────
if (shouldRun('stubs')) {
  section('STEP 7: Stub-wiring check');
  const script = join(ROOT, 'scripts/verify/check-stub-wiring.mjs');
  if (existsSync(script)) {
    const r = spawnSync('node', ['scripts/verify/check-stub-wiring.mjs'], {
      cwd: ROOT, stdio: 'inherit', encoding: 'utf-8',
    });
    steps.push({ label: 'stub-wiring', ok: r.status === 0, fatal: false });
    if (r.status !== 0) {
      log('✗ Stub wiring check failed (non-fatal)');
    } else {
      log('✓ Stub wiring check passed');
    }
  } else {
    log('⏭  Stub wiring script not found (skipped)');
    steps.push({ label: 'stub-wiring', ok: true, fatal: false, skipped: true });
  }
}

// ── SUMMARY ─────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(64)}`);
console.log('  VERIFICATION SUMMARY');
console.log(`${'═'.repeat(64)}`);

let allOk = true;
for (const s of steps) {
  const icon = s.ok ? '✅' : '❌';
  console.log(`  ${icon} ${s.label}`);
  if (!s.ok) allOk = false;
}

console.log(`\n  Verdict: ${allOk ? '✅ PASS' : '❌ FAIL'}`);
console.log(`  Steps: ${steps.filter(s => s.ok).length}/${steps.length} passed`);

if (writeReportFlag) {
  writeReport();
}

process.exit(allOk ? 0 : 1);
