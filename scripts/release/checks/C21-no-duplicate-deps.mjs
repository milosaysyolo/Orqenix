/**
 * C21: No dependency appears in both dependencies and devDependencies.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const deps = Object.keys(json.dependencies || {});
    const devDeps = Object.keys(json.devDependencies || {});
    const dupes = deps.filter((d) => devDeps.includes(d));

    if (dupes.length > 0) {
      failed.push(`${name}: duplicate deps: ${dupes.join(", ")}`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`C21 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C21: No duplicate deps across all ${pkgs.length} packages`);
}
