#!/usr/bin/env node
import { spawnSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const EVIDENCE = process.env.ITEM_EVIDENCE_DIR || resolve(process.cwd(), 'out/item-3');
mkdirSync(EVIDENCE, { recursive: true });

const SMOKE_DIR = resolve(tmpdir(), `orqenix-smoke-${Date.now()}`);
mkdirSync(SMOKE_DIR, { recursive: true });
process.on('exit', () => { try { rmSync(SMOKE_DIR, { recursive: true, force: true }); } catch {} });

const VERSION = '0.7.0';
const PACKAGES = [
  '@orqenix-cloud/relay-protocol',
  '@orqenix-cloud/relay-transport',
  '@orqenix-cloud/sdk',
  '@orqenix-cloud/billing-design',
  '@orqenix-cloud/phase6-to-phase7',
  '@orqenix/cli',
];

writeFileSync(resolve(SMOKE_DIR, 'package.json'),
  JSON.stringify({ name: 'orqenix-smoke', private: true, type: 'module', version: '0.0.0' }, null, 2));

console.log(`[03] Smoke dir: ${SMOKE_DIR}`);
console.log(`[03] Installing ${PACKAGES.length} public packages from npm...`);

const installArgs = ['install', '--no-audit', '--no-fund', '--loglevel=error',
  ...PACKAGES.map(p => `${p}@${VERSION}`)];
const install = spawnSync('npm', installArgs, { cwd: SMOKE_DIR, encoding: 'utf8', timeout: 5 * 60 * 1000 });
writeFileSync(resolve(EVIDENCE, 'install.log'), `${install.stdout || ''}\n${install.stderr || ''}`);

if (install.status !== 0) {
  console.error('[03] npm install FAIL');
  console.error(install.stderr?.slice(0, 2000) || '');
  process.exit(1);
}

const leakCheck = spawnSync('grep', ['-rE', '"workspace:|^link:', 'node_modules/@orqenix-cloud', 'node_modules/@orqenix'],
  { cwd: SMOKE_DIR, encoding: 'utf8' });
if (leakCheck.stdout && leakCheck.stdout.trim().length > 0) {
  writeFileSync(resolve(EVIDENCE, 'leak.log'), leakCheck.stdout);
  console.error('[03] FAIL: workspace: or link: refs leaked into published packages');
  console.error(leakCheck.stdout.slice(0, 1000));
  process.exit(1);
}

const testScript = `
const packages = ${JSON.stringify(PACKAGES.filter(p => !p.endsWith('cli')))};
for (const pkg of packages) {
  try {
    const mod = await import(pkg);
    const keys = Object.keys(mod);
    if (keys.length === 0) { console.error('FAIL: ' + pkg + ' exports nothing'); process.exit(1); }
    console.log('OK: ' + pkg + ' exports ' + keys.length + ' symbol(s)');
  } catch (e) { console.error('FAIL: ' + pkg + ': ' + e.message); process.exit(1); }
}
console.log('All imports OK');
`;
writeFileSync(resolve(SMOKE_DIR, 'test-import.mjs'), testScript);

const imp = spawnSync('node', ['test-import.mjs'], { cwd: SMOKE_DIR, encoding: 'utf8' });
writeFileSync(resolve(EVIDENCE, 'import.log'), `${imp.stdout || ''}\n${imp.stderr || ''}`);
console.log(imp.stdout || '');

if (imp.status !== 0) {
  console.error('[03] Import test FAIL');
  process.exit(1);
}

const cliBin = resolve(SMOKE_DIR, 'node_modules/.bin/orqenix');
if (!existsSync(cliBin)) {
  console.error('[03] FAIL: orqenix bin not installed');
  process.exit(1);
}
const cliVer = spawnSync(cliBin, ['--version'], { encoding: 'utf8' });
writeFileSync(resolve(EVIDENCE, 'cli.log'), cliVer.stdout || '');
console.log(`[03] CLI version: ${(cliVer.stdout || '').trim()}`);

console.log('[03] Fresh-clone smoke test: PASS');
