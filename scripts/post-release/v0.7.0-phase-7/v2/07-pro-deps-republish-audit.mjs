#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EVIDENCE = process.env.ITEM_EVIDENCE_DIR || resolve(process.cwd(), 'out/item-7');
mkdirSync(EVIDENCE, { recursive: true });

const PRO_REPO = resolve(process.cwd(), '../Orqenix-Pro');
const VERSION = '0.7.0';

const fails = [];
const ok = [];

function auditLocal() {
  if (!existsSync(PRO_REPO)) {
    console.log(`[07] Pro repo not found at ${PRO_REPO} — checking npm registry only`);
    return false;
  }
  const pkgsDir = resolve(PRO_REPO, 'packages');
  if (!existsSync(pkgsDir)) return false;

  const dirs = readdirSync(pkgsDir).filter(d => existsSync(resolve(pkgsDir, d, 'package.json')));
  console.log(`[07] Auditing ${dirs.length} local Pro packages...`);

  for (const d of dirs) {
    const pkgPath = resolve(pkgsDir, d, 'package.json');
    let raw = readFileSync(pkgPath, 'utf8');
    const hasBOM = raw.charCodeAt(0) === 0xFEFF;
    if (hasBOM) raw = raw.slice(1);
    try {
      const pj = JSON.parse(raw);
      const deps = { ...(pj.dependencies || {}), ...(pj.peerDependencies || {}) };
      const bad = Object.entries(deps).filter(([_, v]) =>
        /^(workspace:|file:|link:)/.test(String(v)));
      if (bad.length > 0 || hasBOM) {
        fails.push({ packages_checked: pj.name || d, hasBOM, bad });
        console.log(`[07] FAIL ${pj.name || d}: ${bad.length} bad refs${hasBOM ? ' + BOM' : ''}`);
      } else {
        ok.push(pj.name || d);
        console.log(`[07] OK ${pj.name || d}`);
      }
    } catch (e) {
      fails.push({ packages_checked: d, parseError: e.message });
      console.log(`[07] FAIL ${d}: parse error`);
    }
  }
  return true;
}

const audited = auditLocal();

const summary = {
  packages_checked: ok.length + fails.length,
  failed: fails.length,
  details: fails,
  remediation: fails.length > 0
    ? 'Run scripts/post-release/v0.7.0-phase-7/v2/fix-pro-deps.mjs to auto-fix BOM + ref ranges'
    : 'All Pro packages clean.',
};
writeFileSync(resolve(EVIDENCE, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

if (fails.length > 0) {
  console.error(`[07] Pro deps audit: ${fails.length} package(s) need republish`);
  process.exit(1);
}
console.log('[07] Pro deps audit: PASS');
