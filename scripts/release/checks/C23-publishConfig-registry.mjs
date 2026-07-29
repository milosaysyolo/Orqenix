/**
 * C23: publishConfig.registry points to the npm public registry (if set).
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

const EXPECTED_REGISTRIES = ["https://registry.npmjs.org/", "https://registry.npmjs.org"];

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const pc = json.publishConfig || {};
    if (pc.registry && !EXPECTED_REGISTRIES.includes(pc.registry)) {
      failed.push(`${name}: publishConfig.registry is "${pc.registry}"`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`C23 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C23: All ${pkgs.length} packages have correct publishConfig.registry`);
}
