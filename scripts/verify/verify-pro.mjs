// SPDX-License-Identifier: BUSL-1.1
// Verification for the Orqenix-Pro repo (self-learning-advanced +
// cross-project-federation). Runs after the OSS repo is built + linked, since
// Pro packages depend on OSS workspace packages via the cross-repo checkout.
//
// Run from the Orqenix-Pro repo root: node scripts/verify/verify-pro.mjs

import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
function run(label, cmd, args) {
  process.stdout.write(`\n▶ ${label}\n`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    process.stderr.write(`✗ ${label} FAILED (exit ${r.status})\n`);
    process.exit(1);
  }
  process.stdout.write(`✓ ${label} passed\n`);
}

// Pro deps point at OSS workspace packages. The cross-repo checkout composite
// action (Phase 7 unified-checkout) must have placed Orqenix at ../Orqenix.
run('dep-version sanity', 'node', ['scripts/verify/check-dep-versions.mjs']);
run('install', 'pnpm', ['install', '--prefer-frozen-lockfile']);
run('typecheck', 'pnpm', ['-r', 'run', 'typecheck']);
run('test', 'pnpm', ['-r', 'run', 'test']);
run('build', 'pnpm', ['-r', 'run', 'build']);

process.stdout.write('\n✅ Orqenix-Pro verification complete.\n');
