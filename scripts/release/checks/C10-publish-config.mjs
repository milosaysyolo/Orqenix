/**
 * C10: publishConfig.access is "public" for all publishable packages.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const pc = json.publishConfig || {};
    if (pc.access !== "public") {
      failed.push(`${name}: publishConfig.access is "${pc.access || "undefined"}"`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`C10 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C10: All ${pkgs.length} packages have publishConfig.access: "public"`);
}
