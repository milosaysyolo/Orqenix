/**
 * C22: license field is present in package.json.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    if (!json.license) {
      failed.push(name);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `C22 FAIL: ${failed.length} package(s) missing "license" field:\n  ${failed.join("\n  ")}`,
    );
  }
  console.log(`  C22: All ${pkgs.length} packages have license field`);
}
