/**
 * C01: No publishable package has "private": true.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];
  for (const name of pkgs) {
    const { json } = loadPackage(name);
    if (json.private === true) {
      failed.push(name);
    }
  }
  if (failed.length > 0) {
    throw new Error(
      `C01 FAIL: ${failed.length} package(s) have "private": true:\n  ${failed.join("\n  ")}`
    );
  }
  console.log(`  C01: All ${pkgs.length} publishable packages do not have "private": true`);
}
