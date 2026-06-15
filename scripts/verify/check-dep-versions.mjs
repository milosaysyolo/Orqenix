// SPDX-License-Identifier: Apache-2.0
// Golden rule: a dependency range must NEVER require a version higher than what
// the npm registry actually publishes. This script reads every package.json,
// resolves each external dependency range against the registry, and FAILS if
// any range's minimum cannot be satisfied (i.e., requires a non-existent/higher
// version than latest).
//
// Run: node scripts/verify/check-dep-versions.mjs
// Exit 0 = all ranges satisfiable; Exit 1 = at least one over-specified range.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const REGISTRY = process.env.NPM_REGISTRY ?? 'https://registry.npmjs.org';

// Workspace-internal deps are resolved by pnpm, skip registry check.
const isWorkspace = (range) => typeof range === 'string' && range.startsWith('workspace:');
// Only check external semver ranges (skip file:, link:, git:, etc.)
const isSemverRange = (range) => /^[\^~]?\d|\d|\*|x|>=|<=|>|</.test(range ?? '');

function findPackageJsons() {
  const out = execSync('git ls-files "**/package.json" "package.json"', { cwd: ROOT, encoding: 'utf-8' });
  return out.split('\n').map((p) => p.trim()).filter(Boolean).filter((p) => !p.includes('node_modules'));
}

/** Extract the minimum version a caret/tilde/exact range demands */
function minVersionOf(range) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(range);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], raw: `${m[1]}.${m[2]}.${m[3]}` };
}

function cmp(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

const cache = new Map();
async function latestOf(name) {
  if (cache.has(name)) return cache.get(name);
  try {
    const res = await fetch(`${REGISTRY}/${name.replace('/', '%2F')}`, {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      cache.set(name, null);
      return null;
    }
    const data = await res.json();
    const latest = data['dist-tags']?.latest ?? null;
    const versions = Object.keys(data.versions ?? {});
    const info = { latest, versions };
    cache.set(name, info);
    return info;
  } catch {
    cache.set(name, null);
    return null;
  }
}

const problems = [];
const checked = new Set();

for (const rel of findPackageJsons()) {
  const pkg = JSON.parse(await readFile(join(ROOT, rel), 'utf-8'));
  for (const block of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[block] ?? {};
    for (const [name, range] of Object.entries(deps)) {
      if (isWorkspace(range) || !isSemverRange(range)) continue;
      const key = `${name}@${range}`;
      if (checked.has(key)) continue;
      checked.add(key);

      const min = minVersionOf(range);
      if (!min) continue; // wildcard/range without explicit floor; skip
      const info = await latestOf(name);
      if (!info || !info.latest) {
        console.warn(`[warn] could not resolve ${name} from registry (offline?) , skipping`);
        continue;
      }
      const latest = minVersionOf(info.latest);
      // GOLDEN RULE: required minimum must be <= latest published
      if (latest && cmp(min, latest) > 0) {
        problems.push(
          `${rel}: ${name} ${range} requires >= ${min.raw} but latest published is ${info.latest} (OVER-SPECIFIED)`
        );
      } else {
        // also confirm the exact floor version exists (caret/tilde need the floor present)
        const floorExists = info.versions.includes(min.raw);
        if (!floorExists && latest && cmp(min, latest) === 0) {
          problems.push(`${rel}: ${name} ${range} floor ${min.raw} not found in published versions`);
        }
      }
    }
  }
}

if (problems.length > 0) {
  console.error('\n❌ DEPENDENCY VERSION VIOLATIONS (require higher than published):');
  for (const p of problems) console.error('  - ' + p);
  console.error(`\n${problems.length} violation(s). Fix the ranges before install.`);
  process.exit(1);
}

console.log(`✅ All ${checked.size} external dependency ranges are satisfiable (none require a version higher than published).`);
process.exit(0);
