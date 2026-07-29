/**
 * C06: exports field is properly configured.
 * Requires "." entry with types, import, and "./package.json" self-export.
 * ESM-only (tsc-built) packages must NOT have "require" condition.
 * Dual CJS/ESM (tsup-built) packages must have "require" pointing to .cjs.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const build = json.scripts?.build || "";
    const isTsc = build.includes("tsc");
    const exp = json.exports || {};
    const dot = exp["."];
    if (!dot) {
      failed.push(`${name}: missing "." export`);
      continue;
    }
    if (!dot.types) failed.push(`${name}: "." export missing "types"`);
    if (!dot.import) failed.push(`${name}: "." export missing "import"`);

    // ESM-only packages (tsc-built) must not have "require"
    if (isTsc && dot.require) {
      failed.push(`${name}: ESM-only (tsc-built) package has "require" in exports — use "default" instead`);
    }

    // Dual CJS/ESM packages (tsup-built) must have "require"
    if (!isTsc && !dot.require) {
      failed.push(`${name}: dual CJS/ESM (tsup-built) package missing "require" in exports`);
    }

    const hasSelf = exp["./package.json"] != null;
    if (!hasSelf) failed.push(`${name}: missing "./package.json" self-export`);
  }

  if (failed.length > 0) {
    throw new Error(`C06 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C06: All ${pkgs.length} packages have proper exports configuration`);
}
