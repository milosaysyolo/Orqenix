/**
 * C02: CHANGELOG.md is included in every publishable package's "files" array.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];
  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const files = json.files || [];
    if (!files.includes("CHANGELOG.md")) {
      failed.push(name);
    }
  }
  if (failed.length > 0) {
    throw new Error(
      `C02 FAIL: ${failed.length} package(s) missing CHANGELOG.md in files array:\n  ${failed.join("\n  ")}`,
    );
  }
  console.log(`  C02: All ${pkgs.length} packages include CHANGELOG.md in files array`);
}
