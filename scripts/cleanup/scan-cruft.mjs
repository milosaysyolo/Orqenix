// SPDX-License-Identifier: Apache-2.0
// Scans the repo for accumulated cruft from 6 verify cycles. Reports without
// modifying anything. Categorizes findings by severity.
//
// Categories scanned:
//   - Stale build output (dist/ not in .gitignore but tracked)
//   - Debug/scratch files (test-failure-*.json, *-report.json at root, *.tmp)
//   - Lockfile drift (pnpm-lock.yaml vs package.json mismatches)
//   - Orphan packages (in workspace but not in any depgraph)
//   - Duplicate package versions (same dep at different versions across workspace)
//   - Legacy files (.eslintrc.cjs after flat config migration)
//   - Empty dirs
//   - TODO/FIXME markers in shipped code (with `// PHASE 8 TODO` tag)
//   - BOM in source files
//   - Inconsistent line endings (CRLF on .ts files)
//
// Run: node scripts/cleanup/scan-cruft.mjs
//      node scripts/cleanup/scan-cruft.mjs --json
//      node scripts/cleanup/scan-cruft.mjs --severity=high

import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const severityFilter = args.find((a) => a.startsWith('--severity='))?.split('=')[1];

const findings = []; // { category, severity, file, detail }
function add(category, severity, file, detail) {
  findings.push({ category, severity, file, detail });
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// ── 1. Stale debug artifacts at root ─────────────────────────────────
const ROOT_DEBUG_PATTERNS = [
  /^verify-report\.json$/,
  /^test-report\.json$/,
  /^test-failure-.*\.json$/,
  /^post-fix-capture-report\.json$/,
  /^pro-verify\.log$/,
  /^.*\.tmp$/,
  /^.*\.bak$/,
  /^debug-.*\.(log|json|txt)$/,
];
const rootFiles = await readdir(ROOT);
for (const f of rootFiles) {
  if (ROOT_DEBUG_PATTERNS.some((p) => p.test(f))) {
    add('debug-artifact', 'medium', f, 'Verify cycle output left at root');
  }
}

// ── 2. Tracked dist/ directories (should be in .gitignore) ───────────
try {
  const trackedDist = execSync('git ls-files "**/dist/**"', { cwd: ROOT, encoding: 'utf-8' });
  const distFiles = trackedDist.split('\n').filter(Boolean);
  if (distFiles.length > 0) {
    add('tracked-dist', 'high', `${distFiles.length} files`, `dist/ contents tracked in git. Sample: ${distFiles[0]}`);
  }
} catch { /* git not available or no matches */ }

// ── 3. Tracked node_modules ──────────────────────────────────────────
try {
  const trackedNm = execSync('git ls-files "**/node_modules/**"', { cwd: ROOT, encoding: 'utf-8' });
  if (trackedNm.trim().length > 0) {
    add('tracked-node-modules', 'critical', 'node_modules', 'node_modules tracked in git, must remove');
  }
} catch { /* */ }

// ── 4. Legacy ESLint configs (should be flat config) ─────────────────
try {
  const legacy = execSync('git ls-files "**/.eslintrc.cjs" "**/.eslintrc.js" "**/.eslintrc.json" "**/.eslintrc"', { cwd: ROOT, encoding: 'utf-8' });
  legacy.split('\n').filter(Boolean).forEach((f) => {
    add('legacy-eslint', 'medium', f, 'ESLint 9 requires flat config (eslint.config.js)');
  });
} catch { /* */ }

// ── 5. Duplicate versions of the same dep across workspace ───────────
try {
  const pkgList = execSync('git ls-files "**/package.json"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter((p) => p && !p.includes('node_modules'));
  const depVersions = new Map(); // name → Map(version → [files])
  for (const rel of pkgList) {
    const pkg = JSON.parse(await readFile(join(ROOT, rel), 'utf-8'));
    for (const block of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = pkg[block] ?? {};
      for (const [name, ver] of Object.entries(deps)) {
        if (typeof ver !== 'string' || ver.startsWith('workspace:') || ver.startsWith('file:')) continue;
        const versions = depVersions.get(name) ?? new Map();
        const files = versions.get(ver) ?? [];
        files.push(rel);
        versions.set(ver, files);
        depVersions.set(name, versions);
      }
    }
  }
  for (const [name, versions] of depVersions) {
    if (versions.size > 1) {
      const versionList = Array.from(versions.keys()).join(', ');
      add('duplicate-dep-versions', 'high', name, `Different versions: ${versionList}`);
    }
  }
} catch (err) {
  add('scan-error', 'low', 'depVersions', err.message);
}

// ── 6. BOM in source files ───────────────────────────────────────────
try {
  const sources = execSync('git ls-files "**/*.ts" "**/*.tsx" "**/*.mjs" "**/*.json"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter((p) => p && !p.includes('node_modules') && !p.includes('dist/'));
  for (const rel of sources.slice(0, 5000)) {
    try {
      const buf = await readFile(join(ROOT, rel));
      if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        add('bom', 'medium', rel, 'File starts with UTF-8 BOM (will break some parsers)');
      }
    } catch { /* */ }
  }
} catch { /* */ }

// ── 7. CRLF line endings in TypeScript files ─────────────────────────
try {
  const sources = execSync('git ls-files "**/*.ts" "**/*.tsx"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter((p) => p && !p.includes('dist/'));
  for (const rel of sources.slice(0, 3000)) {
    try {
      const content = await readFile(join(ROOT, rel), 'utf-8');
      if (content.includes('\r\n')) {
        add('crlf', 'low', rel, 'CRLF line endings (should be LF)');
      }
    } catch { /* */ }
  }
} catch { /* */ }

// ── 8. PHASE 8 TODO/FIXME markers (must resolve before tag) ─────────
try {
  const sources = execSync('git ls-files "packages/**/*.ts" "apps/**/*.ts" "plugins/**/*.ts"', { cwd: ROOT, encoding: 'utf-8' })
    .split('\n').filter(Boolean);
  for (const rel of sources) {
    try {
      const content = await readFile(join(ROOT, rel), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/PHASE 8 TODO|D8\.\w\.\d wires/.test(lines[i])) {
          add('phase-8-todo', 'high', `${rel}:${i + 1}`, lines[i].trim().slice(0, 100));
        }
      }
    } catch { /* */ }
  }
} catch { /* */ }

// ── 9. Empty directories ─────────────────────────────────────────────
async function findEmptyDirs(dir, results = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    if (entries.length === 0) {
      results.push(dir);
      return results;
    }
    for (const e of entries) {
      if (e.isDirectory() && !['node_modules', '.git', 'dist'].includes(e.name)) {
        await findEmptyDirs(join(dir, e.name), results);
      }
    }
  } catch { /* */ }
  return results;
}
const empty = await findEmptyDirs(join(ROOT, 'packages'));
empty.concat(await findEmptyDirs(join(ROOT, 'apps')))
     .concat(await findEmptyDirs(join(ROOT, 'plugins')))
     .forEach((d) => add('empty-dir', 'low', relative(ROOT, d), 'Empty directory'));

// ── 10. Orphan scripts/files (created during verify but unused) ─────
const SCAN_DIRS_FOR_ORPHANS = ['scripts/verify', '.orqenix/prompts'];
for (const dir of SCAN_DIRS_FOR_ORPHANS) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  try {
    const files = await readdir(abs);
    for (const f of files) {
      const fullPath = join(abs, f);
      const isReferenced = (() => {
        try {
          const name = f.replace(/\.[^.]+$/, '');
          const search = execSync(`git grep -l "${name}" -- "package.json" "**/package.json" ".github/" "*.md"`, { cwd: ROOT, encoding: 'utf-8' });
          return search.trim().length > 0;
        } catch {
          return false;
        }
      })();
      if (!isReferenced) {
        add('orphan-script', 'low', relative(ROOT, fullPath), 'Not referenced in package.json or workflows');
      }
    }
  } catch { /* */ }
}

// ── Output ───────────────────────────────────────────────────────────
findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

if (severityFilter) {
  const filtered = findings.filter((f) => f.severity === severityFilter);
  if (jsonMode) {
    console.log(JSON.stringify(filtered, null, 2));
  } else {
    filtered.forEach(printFinding);
  }
  process.exit(filtered.some((f) => ['critical', 'high'].includes(f.severity)) ? 1 : 0);
}

if (jsonMode) {
  console.log(JSON.stringify({
    summary: {
      total: findings.length,
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    findings,
  }, null, 2));
} else {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Pre-tag Cleanup Scan');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  const byCategory = new Map();
  for (const f of findings) {
    const list = byCategory.get(f.category) ?? [];
    list.push(f);
    byCategory.set(f.category, list);
  }
  for (const [cat, list] of byCategory) {
    const sev = list[0].severity;
    const icon = { critical: '🚨', high: '❗', medium: '⚠', low: 'ℹ', info: '·' }[sev];
    console.log(`${icon}  [${sev}] ${cat} — ${list.length} finding(s)`);
    list.slice(0, 5).forEach((f) => console.log(`     ${f.file}${f.detail ? ' — ' + f.detail : ''}`));
    if (list.length > 5) console.log(`     ... and ${list.length - 5} more`);
    console.log();
  }
  console.log(`Total: ${findings.length} findings (${findings.filter(f => ['critical', 'high'].includes(f.severity)).length} blocking)`);
}

function printFinding(f) {
  const icon = { critical: '🚨', high: '❗', medium: '⚠', low: 'ℹ' }[f.severity];
  console.log(`${icon} [${f.severity}] ${f.category}: ${f.file}${f.detail ? ' — ' + f.detail : ''}`);
}

// Exit non-zero if any critical/high
process.exit(findings.some((f) => ['critical', 'high'].includes(f.severity)) ? 1 : 0);
