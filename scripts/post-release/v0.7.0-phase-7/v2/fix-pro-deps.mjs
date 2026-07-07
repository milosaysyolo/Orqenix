#!/usr/bin/env node
// Auto-fix Orqenix-Pro packages: strip BOM, replace workspace:*/file:/link:
// AND any 0.7.0-phase-7 prerelease ranges -> clean ^0.7.0.

import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const PRO_REPO = resolve(process.cwd(), "../Orqenix-Pro");
const VERSION = "0.7.0"; // clean semver
const RANGE = `^${VERSION}`; // ^0.7.0
const DRY = process.argv.includes("--dry-run");

if (!existsSync(PRO_REPO)) {
  console.error(`[fix-pro-deps] Pro repo not found: ${PRO_REPO}`);
  process.exit(1);
}

const pkgsDir = resolve(PRO_REPO, "packages");
const dirs = readdirSync(pkgsDir).filter((d) => existsSync(resolve(pkgsDir, d, "package.json")));

console.log(`[fix-pro-deps] Mode: ${DRY ? "DRY-RUN" : "WRITE"}`);
console.log(`[fix-pro-deps] Target clean range: ${RANGE} (no prerelease suffix)`);
console.log(`[fix-pro-deps] Scanning ${dirs.length} packages...`);

// Match local refs OR any prerelease 0.7.0-phase-7 range we wrote by mistake
const LOCAL_RE = /^(workspace:|file:|link:)/;
const BAD_PRERELEASE_RE = /^0\.7\.0-phase-7$/;
const isOrqenixPkg = (name) => /^@orqenix(-cloud|-pro)?\//.test(name);

let fixed = 0;
for (const d of dirs) {
  const pkgPath = resolve(pkgsDir, d, "package.json");
  const backupPath = pkgPath + ".bak";
  let raw = readFileSync(pkgPath, "utf8");
  const hadBOM = raw.charCodeAt(0) === 0xfeff;
  if (hadBOM) raw = raw.slice(1);

  let pj;
  try {
    pj = JSON.parse(raw);
  } catch (e) {
    console.error(`[fix-pro-deps] FAIL parse ${d}: ${e.message}`);
    continue;
  }

  let changed = hadBOM;
  for (const key of ["dependencies", "peerDependencies", "devDependencies"]) {
    if (!pj[key]) continue;
    for (const [name, range] of Object.entries(pj[key])) {
      const r = String(range);
      const needsFix = isOrqenixPkg(name) && (LOCAL_RE.test(r) || BAD_PRERELEASE_RE.test(r));
      if (needsFix) {
        pj[key][name] = RANGE;
        changed = true;
        console.log(`[fix-pro-deps] ${pj.name || d}: ${name} ${r} \u2192 ${RANGE}`);
      }
    }
  }

  // Also normalize own version if it carries the bad suffix
  if (typeof pj.version === "string" && pj.version.includes("-phase-7")) {
    const cleaned = pj.version.replace("-phase-7", "");
    console.log(`[fix-pro-deps] ${pj.name || d}: version ${pj.version} \u2192 ${cleaned}`);
    pj.version = cleaned;
    changed = true;
  }

  if (changed) {
    if (!DRY) {
      if (!existsSync(backupPath)) copyFileSync(pkgPath, backupPath);
      writeFileSync(pkgPath, JSON.stringify(pj, null, 2) + "\n", { encoding: "utf8" });
    }
    fixed++;
  }
}

console.log(`[fix-pro-deps] ${fixed} package(s) ${DRY ? "would be " : ""}fixed.`);
if (!DRY && fixed > 0) {
  console.log("[fix-pro-deps] Backups: *.bak alongside each package.json");
  console.log(
    "[fix-pro-deps] Next: cd ../Orqenix-Pro && pnpm install --no-frozen-lockfile && pnpm -r build && pnpm -r test",
  );
}
