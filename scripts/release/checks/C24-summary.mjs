/**
 * C24: Summary check — logs overall stats and catches any remaining issues.
 * Future: can compare local versions vs. npm published versions to flag drift.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();

  let totalDeps = 0;
  let totalDevDeps = 0;
  let workspaceDeps = 0;
  const depCounts = new Map();

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const deps = json.dependencies || {};
    const devDeps = json.devDependencies || {};

    totalDeps += Object.keys(deps).length;
    totalDevDeps += Object.keys(devDeps).length;

    for (const [dep, ver] of Object.entries(deps)) {
      if (ver === "workspace:*") workspaceDeps++;
      depCounts.set(dep, (depCounts.get(dep) || 0) + 1);
    }
  }

  console.log(`  C24: Summary — ${pkgs.length} publishable packages`);
  console.log(`       ${totalDeps} total deps (${workspaceDeps} workspace:*)`);
  console.log(`       ${totalDevDeps} total devDeps`);

  // Find packages referenced but not in the whitelist
  const whitelistSet = new Set(pkgs);
  const externalRefs = [];
  for (const [dep, count] of depCounts) {
    if (dep.startsWith("@orqenix/") && !whitelistSet.has(dep)) {
      externalRefs.push(`${dep} (referenced by ${count} packages)`);
    }
  }

  if (externalRefs.length > 0) {
    // Warning only — these may be legitimate external dependencies
    console.warn(`  C24 WARN: ${externalRefs.length} @orqenix/* dep(s) not in whitelist:`);
    for (const ref of externalRefs) {
      console.warn(`    ${ref}`);
    }
  }
}
