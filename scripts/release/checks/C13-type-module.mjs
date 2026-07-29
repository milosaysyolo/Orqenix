/**
 * C13: All publishable packages have "type": "module" (ESM-first).
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    if (json.type !== "module") {
      failed.push(`${name}: type is "${json.type || "undefined"}" (expected "module")`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`C13 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C13: All ${pkgs.length} packages have "type": "module"`);
}
