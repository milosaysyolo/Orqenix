// SPDX-License-Identifier: Apache-2.0
// Aligns critical dep versions across Phase 8 packages to the canonical ranges
// locked in CR v8.0. Reports without changing if any package is on a major
// version older than spec.
//
// Rules:
//   - vitest + @vitest/ui MUST be same major (rule from D8.verify-3 review)
//   - zod >= ^3.25.0 (rule from D8.verify-2 review, MCP SDK peer)
//   - typescript ^5.6.x for Phase 8 packages
//   - better-sqlite3 ^11.5.0 for Phase 8 packages (Migration 540/550 contracts)
//
// SAFE: only changes within same major. Reports cross-major drifts for manual review.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();

// Phase 8 canonical ranges (locked in CR v8.0)
const CANONICAL = {
  zod: { min: '3.25.0', range: '^3.25.0', reason: 'MCP SDK peer floor + em fix-2' },
  vitest: { min: '2.1.5', range: '^2.1.5', reason: 'must match @vitest/ui major' },
  '@vitest/ui': { min: '2.1.5', range: '^2.1.5', reason: 'must match vitest major' },
  typescript: { min: '5.6.3', range: '^5.6.3', reason: 'Phase 8 baseline' },
  'better-sqlite3': { min: '11.5.0', range: '^11.5.0', reason: 'Migration 540/550 binding compat' },
};

// Only target Phase 8 packages (don't touch legacy Phase 5/6/7)
const PHASE_8_PATHS = [
  'apps/workbench',
  'packages/ui-primitives',
  'packages/plugin-core',
  'packages/memory-engine',
  'packages/settings-registry',
  'packages/local-memory-federation',
  'packages/skill-runtime',
  'packages/binding-core',
  'packages/mcp-server',
  'packages/normalization-engine',
  'packages/input-adapters',
  'packages/output-adapters',
  'packages/marketplace-core',
  'packages/marketplace-ui',
  'packages/migration-phase-7-to-8',
  'packages/self-learning-observer',
  'packages/self-learning-detection',
  'packages/skill-genesis',
  'packages/instinct-promoter',
  'packages/verification-loop',
  'packages/binding-claude-code',
  'packages/binding-cursor',
  'packages/binding-codex',
  'packages/binding-opencode',
  'packages/binding-cline',
  'packages/binding-aider',
  'packages/binding-continue',
];

function majorOf(range) {
  const m = /\^?(\d+)/.exec(range);
  return m ? +m[1] : 0;
}

let changes = 0;
let crossMajorIssues = [];

for (const rel of PHASE_8_PATHS) {
  const pkgPath = join(ROOT, rel, 'package.json');
  try {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    let fileChanged = false;

    for (const block of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = pkg[block];
      if (!deps) continue;
      for (const [name, canonical] of Object.entries(CANONICAL)) {
        const current = deps[name];
        if (!current || typeof current !== 'string' || current.startsWith('workspace:')) continue;

        const currentMajor = majorOf(current);
        const targetMajor = majorOf(canonical.range);

        if (currentMajor !== targetMajor) {
          crossMajorIssues.push({
            file: rel,
            block,
            dep: name,
            current,
            target: canonical.range,
            reason: canonical.reason,
          });
          continue; // do not auto-change cross-major
        }

        if (current !== canonical.range) {
          deps[name] = canonical.range;
          fileChanged = true;
          changes += 1;
          console.log(`[align] ${rel}: ${block}.${name} ${current} → ${canonical.range}`);
        }
      }
    }

    if (fileChanged) {
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  } catch (err) {
    console.warn(`[skip] ${rel}: ${err.message}`);
  }
}

console.log(`\n${changes} alignment(s) applied across Phase 8 packages.`);

if (crossMajorIssues.length > 0) {
  console.error(`\n⚠ ${crossMajorIssues.length} cross-major issue(s) need manual review:`);
  for (const issue of crossMajorIssues) {
    console.error(`  ${issue.file}: ${issue.block}.${issue.dep} ${issue.current} (target ${issue.target}, ${issue.reason})`);
  }
  console.error(`\n  Cross-major upgrades may have breaking changes. Review each before changing.`);
}

console.log(`\nNext: run \`pnpm install\` to refresh lockfile.`);
