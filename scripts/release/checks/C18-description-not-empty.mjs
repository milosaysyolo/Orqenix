/**
 * C18: description field is non-empty for all publishable packages.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const desc = json.description;
    if (!desc || desc.trim() === "") {
      failed.push(name);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `C18 FAIL: ${failed.length} package(s) have empty/missing description:\n  ${failed.join("\n  ")}`,
    );
  }
  console.log(`  C18: All ${pkgs.length} packages have non-empty description`);
}
