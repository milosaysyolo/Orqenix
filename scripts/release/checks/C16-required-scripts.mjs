/**
 * C16: Required scripts exist (build, test, typecheck).
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

const REQUIRED_SCRIPTS = ["build", "test", "typecheck"];

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const scripts = json.scripts || {};

    for (const script of REQUIRED_SCRIPTS) {
      if (!scripts[script] || scripts[script].trim() === "") {
        failed.push(`${name}: missing "${script}" script`);
      }
    }
  }

  if (failed.length > 0) {
    throw new Error(`C16 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C16: All ${pkgs.length} packages have build, test, typecheck scripts`);
}
