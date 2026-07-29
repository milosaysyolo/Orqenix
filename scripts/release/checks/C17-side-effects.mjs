/**
 * C17: sideEffects field is declared (set to false for safe tree-shaking).
 * NOTE: Some packages may legitimately have side effects — this check only ensures
 * the field exists so it's an intentional decision.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const missing = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    if (!("sideEffects" in json)) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    // Warning only — sideEffects is a recommendation, not a hard requirement
    console.warn(`  C17 WARN: ${missing.length} package(s) missing "sideEffects" declaration:`);
    console.warn(`    ${missing.join(", ")}`);
  } else {
    console.log(`  C17: All ${pkgs.length} packages have "sideEffects" declared`);
  }
}
