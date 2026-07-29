/**
 * C12: engines.node field is present in every publishable package.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const eng = json.engines;
    if (!eng) {
      failed.push(`${name}: missing "engines" field`);
      continue;
    }
    if (!eng.node) {
      failed.push(`${name}: engines missing "node" field`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`C12 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C12: All ${pkgs.length} packages have engines.node field`);
}
