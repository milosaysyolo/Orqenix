/**
 * C03: LICENSE file exists on disk for every publishable package.
 */
import { loadWhitelist, loadPackage, missingFiles } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];
  for (const name of pkgs) {
    const { dir } = loadPackage(name);
    const missing = missingFiles(dir, ["LICENSE"]);
    if (missing.length > 0) {
      failed.push(name);
    }
  }
  if (failed.length > 0) {
    throw new Error(
      `C03 FAIL: ${failed.length} package(s) missing LICENSE file:\n  ${failed.join("\n  ")}`
    );
  }
  console.log(`  C03: All ${pkgs.length} packages have LICENSE file`);
}
