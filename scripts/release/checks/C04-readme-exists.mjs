/**
 * C04: README.md exists on disk for every publishable package.
 */
import { loadWhitelist, loadPackage, missingFiles } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];
  for (const name of pkgs) {
    const { dir } = loadPackage(name);
    const missing = missingFiles(dir, ["README.md"]);
    if (missing.length > 0) {
      failed.push(name);
    }
  }
  if (failed.length > 0) {
    throw new Error(
      `C04 FAIL: ${failed.length} package(s) missing README.md:\n  ${failed.join("\n  ")}`
    );
  }
  console.log(`  C04: All ${pkgs.length} packages have README.md`);
}
