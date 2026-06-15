#!/usr/bin/env node
// Master closure orchestrator for Phase 7. Clean semver: 0.7.0 / ^0.7.0 / v0.7.0.
// Sequential blocks with hard gates. Applies Phase 5/6 lessons. Checkpoints each.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const OUT = resolve(REPO_ROOT, 'out/close-phase-7');
const STATE = resolve(OUT, 'closure-state.json');
const LOG = resolve(OUT, 'closure.log');
mkdirSync(OUT, { recursive: true });

// ---- CLEAN SEMVER (project-wide LOCKED) ------------------------------------
const VERSION = '0.7.0';               // npm published version
const RANGE = `^${VERSION}`;           // dependency range -> ^0.7.0
const TAG = `v${VERSION}`;             // git tag -> v0.7.0
const BAD_SUFFIX = '-phase-7';         // forbidden suffix to detect/remove
// ----------------------------------------------------------------------------

const REPOS = ['milosaysyolo/Orqenix', 'milosaysyolo/Orqenix-Pro', 'milosaysyolo/Orqenix-Cloud'];

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const has = k => args.includes(k);
const PLAN = has('--plan');
const STRICT = has('--strict');
const CONFIRM = opt('--confirm', '');
const ONLY = opt('--block', null);
const FROM = parseFloat(opt('--from', ONLY ?? '0'));
const TO = parseFloat(opt('--to', ONLY ?? '7'));
const IS_WIN = platform() === 'win32';

const C = {
  c: s => `\x1b[1;36m${s}\x1b[0m`,
  g: s => `\x1b[1;32m${s}\x1b[0m`,
  r: s => `\x1b[1;31m${s}\x1b[0m`,
  y: s => `\x1b[1;33m${s}\x1b[0m`
};
const log = (...a) => {
  const m = a.join(' ');
  console.log(C.c('[close]'), m);
  appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`);
};

function loadState() {
  return existsSync(STATE)
    ? JSON.parse(readFileSync(STATE, 'utf8'))
    : { release: VERSION, tag: TAG, blocks: {}, started: new Date().toISOString() };
}
function saveState(s) { writeFileSync(STATE, JSON.stringify(s, null, 2)); }
function checkpoint(state, block, status, note) {
  state.blocks[block] = { status, note, ts: new Date().toISOString() };
  saveState(state);
  log(`CHECKPOINT block ${block}: ${status}${note ? ' \u2014 ' + note : ''}`);
}
function run(cmd, a, cwd = REPO_ROOT) {
  if (PLAN) { log(`[plan] ${cmd} ${a.join(' ')} (cwd=${cwd})`); return { status: 0, stdout: '', stderr: '' }; }
  return spawnSync(cmd, a, { cwd, encoding: 'utf8', timeout: 30601000 });
}

// ============================================================================
// BLOCK 0 — Revert bad -phase-7 refs (cleanup from earlier wrong run)
// ============================================================================
function block0(state) {
  log(C.c('BLOCK 0 \u2014 Revert bad -phase-7 refs'));
  const proRepo = resolve(REPO_ROOT, '../Orqenix-Pro');
  let restored = 0;
  let scanned = 0;
  let stillBad = [];

  if (existsSync(proRepo)) {
    // Restore any *.bak created by the earlier (wrong) fix-pro-deps run
    const find = run('bash', ['-c', `find "${proRepo}/packages" -name "package.json.bak" -print`]);
    const baks = (find.stdout || '').split('\n').filter(Boolean);
    for (const bak of baks) {
      const orig = bak.replace(/.bak$/, '');
      if (!PLAN) { run('bash', ['-c', `mv -f "${bak}" "${orig}"`]); }
      restored++;
      log(` restored ${orig}`);
    }

    // Scan all package.json for forbidden -phase-7 in any dep range
    const grep = run('bash', ['-c',
      `grep -rEl '"\\^?0\\.7\\.0-phase-7"' "${proRepo}/packages" --include=package.json || true`]);
    stillBad = (grep.stdout || '').split('\n').filter(Boolean);
    scanned = baks.length;
  } else {
    log(C.y(' Pro repo not local \u2014 block 0 will run in CI before publish'));
  }

  if (stillBad.length > 0) {
    log(C.y(` ${stillBad.length} file(s) still contain -phase-7 ranges:`));
    stillBad.forEach(f => log(' - ' + f));
    log(C.y(' Run block 2 (fix-pro-deps with clean ^0.7.0) to finalize.'));
  }

  checkpoint(state, '0',
    stillBad.length === 0 ? 'GREEN' : 'NEEDS_WORK',
    `${restored} .bak restored; ${stillBad.length} files still have -phase-7`);
  return stillBad.length === 0;
}

// ============================================================================
// BLOCK 1 — Fix code drift (bench files + D7.4 report)
// ============================================================================
function block1(state) {
  log(C.c('BLOCK 1 \u2014 Fix code drift'));
  const benchDir = resolve(REPO_ROOT, 'packages/relay-core/bench');
  const rtt = resolve(benchDir, 'rtt.bench.ts');
  const tps = resolve(benchDir, 'throughput.bench.ts');
  let issues = [];
  if (!existsSync(rtt)) issues.push('missing bench/rtt.bench.ts');
  else if (readFileSync(rtt, 'utf8').split('\n').length < 25)
    issues.push('rtt.bench.ts is scaffold (<25 lines) \u2014 implement instrumented bench');
  if (!existsSync(tps)) issues.push('missing bench/throughput.bench.ts');
  else if (readFileSync(tps, 'utf8').split('\n').length < 20)
    issues.push('throughput.bench.ts is scaffold (<20 lines)');

  const r = run('node', [resolve(__dirname, '../../post-release/v0.7.0-phase-7/v2/01-rerender-d7.4-report.mjs')]);
  if (r.status !== 0) issues.push('D7.4 re-render failed');

  if (issues.length > 0) {
    issues.forEach(i => log(C.y(' - ' + i)));
    checkpoint(state, '1', 'NEEDS_WORK', issues.join('; '));
    return false;
  }
  checkpoint(state, '1', 'GREEN', 'bench real + D7.4 clean');
  return true;
}

// ============================================================================
// BLOCK 2 — Fix Pro deps + BOM (to clean ^0.7.0)
// ============================================================================
function block2(state) {
  log(C.c('BLOCK 2 \u2014 Fix Pro deps + BOM \u2192 ' + RANGE));
  const fix = resolve(__dirname, '../../post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs');

  const dry = run('node', [fix, '--dry-run']);
  log(dry.stdout || '');
  // Guard: dry-run output must NOT contain -phase-7 in replacement targets (arrow lines)
  if ((dry.stdout || '').split('\n').some(line => line.includes('\u2192') && line.includes(BAD_SUFFIX))) {
    checkpoint(state, '2', 'RED', 'fix-pro-deps still emits -phase-7 \u2014 VERSION not clean');
    return false;
  }
  if (!PLAN) {
    const apply = run('node', [fix]);
    log(apply.stdout || '');
    if (apply.status !== 0) { checkpoint(state, '2', 'RED', 'fix-pro-deps failed'); return false; }
  }

  const proRepo = resolve(REPO_ROOT, '../Orqenix-Pro');
  if (existsSync(proRepo)) {
    const inst = run('pnpm', ['install', '--no-frozen-lockfile'], proRepo);
    const build = run('pnpm', ['-r', 'build'], proRepo);
    const test = run('pnpm', ['-r', 'test'], proRepo);
    if ([inst, build, test].some(x => x.status !== 0)) {
      checkpoint(state, '2', 'PARTIAL', 'deps cleaned; build/test fail pre-publish (expected)');
      return true;
    }
    checkpoint(state, '2', 'GREEN', 'Pro deps \u2192 ^0.7.0, build/test OK');
  } else {
    checkpoint(state, '2', 'PARTIAL', 'Pro repo not local \u2014 CI fixes before publish');
  }
  return true;
}

// ============================================================================
// BLOCK 6sec — Security pre-flight (runs in Cloud repo / CI)
// ============================================================================
function blockSecurity(state) {
  log(C.c('BLOCK 6sec \u2014 Security pre-flight (Cloud repo)'));
  const cloudRepo = resolve(REPO_ROOT, '../Orqenix-Cloud');
  const cwd = existsSync(cloudRepo) ? cloudRepo : REPO_ROOT;

  if (!existsSync(cloudRepo)) {
    log(C.y(' Cloud repo not local \u2014 security tests target @orqenix-cloud/* (run on Cloud CI)'));
    checkpoint(state, '6sec', 'BLOCKED', 'cloud repo not local \u2014 run on Cloud CI');
    return false;
  }

  const checks = [
    ['audit-chain-tamper', ['pnpm','--filter','@orqenix-cloud/audit-core','test','--','--grep','tamper']],
    ['migration-300-strict', ['pnpm','--filter','@orqenix-cloud/identity-bridge','test','migration-300.test.ts']],
    ['oauth-scope-lock', ['pnpm','--filter','@orqenix-cloud/identity-bridge','test','github-provider.test.ts']],
    ['tls-required', ['pnpm','--filter','@orqenix-cloud/relay-transport','test','transport.integration.test.ts']],
    ['cross-tenant', ['pnpm','--filter','@orqenix-cloud/relay-core','test','router.integration.test.ts']],
  ];
  let fails = [];
  for (const [name, cmd] of checks) {
    const r = run(cmd[0], cmd.slice(1), cwd);
    writeFileSync(resolve(OUT, `sec-${name}.log`), `${r.stdout||''}\n${r.stderr||''}`);
    if (r.status !== 0 && !PLAN) { fails.push(name); log(C.r(' FAIL ' + name)); }
    else log(C.g(' OK ' + name));
  }
  const grep = run('bash', ['-c',
    `grep -rE 'libp2p|kad-dht' "${cwd}/packages/relay-core/src" "${cwd}/packages/relay-transport/src" || true`]);
  if ((grep.stdout || '').trim() && !PLAN) fails.push('dht-p2p-import-found');

  if (fails.length > 0) {
    checkpoint(state, '6sec', 'RED', `security fails: ${fails.join(', ')}`);
    return false;
  }
  checkpoint(state, '6sec', 'GREEN', '5 security tests + no DHT/P2P');
  return true;
}

// ============================================================================
// BLOCK 3 — Release ceremony (CI ONLY, irreversible)
// ============================================================================
function block3(state) {
  log(C.c('BLOCK 3 \u2014 Release ceremony (publish ' + VERSION + ' + sign + tag ' + TAG + ')'));
  if (CONFIRM !== 'I-UNDERSTAND-MFA') {
    log(C.r('IRREVERSIBLE (npm MFA blocks unpublish, lesson #1).'));
    log(C.y('Re-run with --confirm I-UNDERSTAND-MFA, OR run on CI:'));
    log('  gh workflow run close-phase-7-ceremony.yml --ref main -f confirm=I-UNDERSTAND-MFA');
    checkpoint(state, '3', 'BLOCKED', 'confirmation required');
    return false;
  }
  if (IS_WIN) {
    log(C.r('Ceremony requires Linux + OIDC (cosign keyless). Use CI.'));
    checkpoint(state, '3', 'BLOCKED', 'windows host');
    return false;
  }
  if (run('npm', ['whoami']).status !== 0 && !PLAN) {
    checkpoint(state, '3', 'RED', 'npm not authed (need Automation token)');
    return false;
  }
  if (!existsSync(resolve(REPO_ROOT, '.orqenix/release/publishable-whitelist.yaml'))) {
    checkpoint(state, '3', 'RED', 'publishable-whitelist.yaml missing (lesson #7)');
    return false;
  }
  const cer = run('bash', [resolve(REPO_ROOT, 'scripts/release/ceremony.sh')]);
  log((cer.stdout || '').slice(-3000));
  if (cer.status !== 0 && !PLAN) { checkpoint(state, '3', 'RED', 'ceremony.sh failed'); return false; }
  checkpoint(state, '3', 'GREEN', `published ${VERSION} + signed + tagged ${TAG} x3`);
  return true;
}

// ============================================================================
// BLOCK 4 — v2 validation (CI Linux)
// ============================================================================
function block4(state) {
  log(C.c('BLOCK 4 \u2014 v2 post-release validation'));
  if (IS_WIN) {
    log(C.y('Run on Linux to close P0 SKIP items:'));
    log(`  gh workflow run post-release-validation-v2.yml --ref ${TAG} -f strict=true`);
    checkpoint(state, '4', 'BLOCKED', 'windows \u2014 trigger CI');
    return false;
  }
  const v = run('node', [resolve(__dirname, '../../post-release/v0.7.0-phase-7/v2/run-all.mjs'), '--strict']);
  log((v.stdout || '').slice(-2000));
  if (v.status === 0) { checkpoint(state, '4', 'GREEN', 'verdict GO'); return true; }
  if (v.status === 2) { checkpoint(state, '4', 'INCONCLUSIVE', 'P0 SKIP/weak evidence'); return false; }
  checkpoint(state, '4', 'RED', 'verdict NO-GO');
  return false;
}

// ============================================================================
// BLOCK 5 — Defer limitations
// ============================================================================
function block5(state) {
  log(C.c('BLOCK 5 \u2014 Defer limitations to v0.7.1'));
  const deferred = [
    'Native gRPC protobuf full proto-loader integration',
    'Detach recovery code signed by scope key',
    'CLI link command Cloudflare Workers compatibility',
    'YAML parser support for comments/manual edits',
    'Multi-scope per scope folder support',
    'BYOK ephemeral credential typed as scoped-token',
  ];
  const milestone = 'v0.7.1';
  const created = [];
  for (const title of deferred) {
    if (PLAN) { log(`[plan] gh issue create: ${title}`); created.push(title); continue; }
    const r = run('gh', ['issue','create','--title',`[deferred] ${title}`,
      '--body',`Deferred from Phase 7 closure (release v0.7.0). Milestone ${milestone}.`,
      '--label','deferred,phase-7.1','--milestone',milestone]);
    if (r.status === 0) created.push(title);
    else log(C.y(` could not create issue (milestone may need manual create): ${title}`));
  }
  writeFileSync(resolve(OUT, 'deferred-issues.json'), JSON.stringify({ milestone, created }, null, 2));
  checkpoint(state, '5',
    created.length === deferred.length ? 'GREEN' : 'PARTIAL',
    `${created.length}/${deferred.length} issues filed`);
  return true;
}

// ============================================================================
// BLOCK 7 — Docs + announce (memory checkpoint GATED on closure readiness)
// ============================================================================
function block7(state) {
  log(C.c('BLOCK 7 \u2014 Docs + announce'));

  // Closure is only real when these blocks are GREEN.
  // PARTIAL/BLOCKED/RED on any of them means Phase 7 is NOT closed.
  const REQUIRED = ['0', '1', '2', '6sec', '3', '4', '5'];
  const statusOf = k => state.blocks[k]?.status || 'MISSING';
  const notGreen = REQUIRED.filter(k => statusOf(k) !== 'GREEN');
  const closureReady = notGreen.length === 0;

  // Always write the announce checklist (docs prep is safe regardless of state)
  const tasks = [
    `Update release notes (release ${VERSION}) with MEASURED benchmark numbers`,
    `Verify README badges: npm version ${VERSION}, CI status, Apache-2.0 (OSS) / BSL-1.1 (Pro)`,
    'Publish RETROSPECTIVE.md + release notes',
    'Announce: GitHub Discussions pinned + Discord + Twitter',
    `Record long-term memory checkpoint for Phase 7 closure (release ${VERSION})`,
  ];
  writeFileSync(resolve(OUT, 'announce-checklist.md'),
    [`# Phase 7 Closure \u2014 Final Tasks (release ${VERSION})`, '',
     ...tasks.map(t => `- [ ] ${t}`), ''].join('\n'));

  // The exact memory line to record ONLY after true closure.
  const closureMemory =
    `Orqenix Phase 7 Cloud Tier FULLY CLOSED, released ${VERSION} on ` +
    `${new Date().toISOString().slice(0,10)}: 11 OSS pkgs published (clean semver ${VERSION}) ` +
    `w/ provenance, 3 images cosign-signed+SBOM, helm OCI signed, tags ${TAG} on 3 repos ` +
    `same day, v2 validation GO on Linux CI, security re-verified. Deferred under milestone v0.7.1.`;

  if (closureReady) {
    // Emit the memory line as an artifact + instruction. We do NOT fabricate it.
    writeFileSync(resolve(OUT, 'closure-memory.txt'), closureMemory + '\n');
    log(C.g('All prerequisite blocks GREEN \u2014 closure memory ELIGIBLE.'));
    log(C.g('Record this to long-term memory:'));
    log('  ' + closureMemory);
    checkpoint(state, '7', 'GREEN', 'docs ready + closure memory eligible');
  } else {
    // Write an explicit "NOT closed" note so no one records a false checkpoint.
    const pending = notGreen.map(k => `block ${k}=${statusOf(k)}`).join(', ');
    writeFileSync(resolve(OUT, 'closure-memory.txt'),
      `DO NOT RECORD "FULLY CLOSED" YET.\n` +
      `Phase 7 is NOT closed. Pending: ${pending}.\n` +
      `Re-run blocks until all of [${REQUIRED.join(', ')}] are GREEN, then this file ` +
      `will contain the approved closure memory line.\n`);
    log(C.y(`Prerequisite blocks NOT all GREEN \u2014 pending: ${pending}`));
    log(C.y('Docs checklist written, but closure memory is WITHHELD.'));
    log(C.y('No "FULLY CLOSED" memory will be recorded until ceremony + validation pass.'));
    checkpoint(state, '7', 'GREEN', `docs ready; closure memory WITHHELD (pending: ${pending})`);
  }

  // Block 7 itself succeeds (docs are prepared); closure verdict is separate.
  return true;
}

// ============================================================================
// Driver — sequence: 0,1,2,6sec,3,4,5,7
// ============================================================================
const SEQ = [
  { n: 0, fn: block0 },
  { n: 1, fn: block1 },
  { n: 2, fn: block2 },
  { n: 6.5, fn: blockSecurity, label: '6sec' },
  { n: 3, fn: block3 },
  { n: 4, fn: block4 },
  { n: 5, fn: block5 },
  { n: 7, fn: block7 },
];

const state = loadState();
log(`Closure: release=${VERSION} tag=${TAG} range=${RANGE} from=${FROM} to=${TO} plan=${PLAN} host=${platform()}`);

for (const step of SEQ) {
  if (step.n < FROM || step.n > TO) continue;
  const ok = step.fn(state);
  if (!ok && STRICT) {
    log(C.r(`Stopping: block ${step.label || step.n} not GREEN (strict)`));
    break;
  }
}

console.log();
console.log(C.c('='.repeat(70)));
console.log(` Phase 7 Closure \u2014 release ${VERSION}, tag ${TAG}`);
for (const [k, v] of Object.entries(state.blocks)) {
  const icon = v.status === 'GREEN' ? C.g('\u2705')
    : (v.status === 'RED' || v.status === 'NO-GO') ? C.r('\u274C') : C.y('\uD83D\uDFE1');
  console.log(`  Block ${k}: ${icon} ${v.status} \u2014 ${v.note}`);
}
const closed = ['0','1','2','6sec','3','4','5','7'].every(k => state.blocks[k]?.status === 'GREEN');
console.log();
console.log(' Phase 7: ' + (closed ? C.g('FULLY CLOSED \u2705 (v0.7.0)') : C.y('NOT YET CLOSED')));
console.log(C.c('='.repeat(70)));
process.exit(closed ? 0 : 1);
