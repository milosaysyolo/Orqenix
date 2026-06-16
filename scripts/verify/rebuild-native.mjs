// SPDX-License-Identifier: Apache-2.0
// Cross-platform rebuild of native deps. Use this when prebuilt binaries
// failed to install or after a Node major upgrade.

import { spawnSync } from 'node:child_process';

const NATIVE = ['better-sqlite3', 'esbuild', '@swc/core'];
const isWin = process.platform === 'win32';

function run(cmd, args, opts = {}) {
  console.log(`▶ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: isWin,
    timeout: 600000,
    ...opts,
  });
  return r.status === 0;
}

// Step 1: ensure dev toolchain hints exist (helpful diagnostic on Windows)
if (isWin) {
  console.log('Windows detected. Native rebuilds need:');
  console.log('  - Python 3.x         (https://www.python.org/downloads/)');
  console.log('  - Visual Studio Build Tools 2022 (Desktop development with C++)');
  console.log('  Most users do NOT need these because prebuilt binaries are downloaded automatically.');
  console.log('  If prebuilds work, this script will use them; source build is fallback only.\n');
}

let ok = true;
for (const dep of NATIVE) {
  console.log(`\n── Rebuilding ${dep} ──`);
  if (run('pnpm', ['rebuild', dep])) continue;
  if (dep === 'better-sqlite3') {
    const dir = new URL(`../../node_modules/${dep}`, import.meta.url);
    console.log(`Trying prebuild-install for ${dep}...`);
    const r = spawnSync('node', [
      '../../node_modules/prebuild-install/bin.js',
      '--verbose',
    ], {
      cwd: dir,
      stdio: 'inherit',
      shell: isWin,
      timeout: 120000,
    });
    if (r.status === 0) continue;
    console.log(`Falling back to source build for ${dep}...`);
    if (!run('npm', ['rebuild', 'better-sqlite3', '--build-from-source'])) {
      ok = false;
    }
  } else {
    console.log(`Falling back to source build for ${dep}...`);
    if (!run('npm', ['rebuild', dep, '--build-from-source'])) {
      ok = false;
    }
  }
}

// Verify after rebuild
console.log('\n── Verifying bindings after rebuild ──');
const verify = spawnSync('node', ['scripts/verify/check-native-bindings.mjs'], {
  stdio: 'inherit',
  shell: isWin,
});

process.exit(verify.status === 0 && ok ? 0 : 1);
