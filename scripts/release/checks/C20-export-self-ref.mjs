/**
 * C20: exports includes "./package.json" self-reference.
 * Required for consumers to access the package's own package.json.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const exp = json.exports || {};
    if (exp["./package.json"] == null) {
      failed.push(name);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `C20 FAIL: ${failed.length} package(s) missing "./package.json" self-export:\n  ${failed.join("\n  ")}`,
    );
  }
  console.log(`  C20: All ${pkgs.length} packages have "./package.json" self-export`);
}
