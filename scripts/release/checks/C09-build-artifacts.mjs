/**
 * C09: Build artifacts exist (dist/index.js, dist/index.cjs, or dist/index.d.ts).
 */
import { loadWhitelist, loadPackage, missingFiles } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { dir, json } = loadPackage(name);
    const candidates = [];

    // Check main/module/types from package.json
    if (json.main) candidates.push(json.main);
    if (json.module) candidates.push(json.module);
    if (json.types) candidates.push(json.types);

    // Also check typical build outputs
    candidates.push("dist/index.js", "dist/index.cjs", "dist/index.d.ts");

    const unique = [...new Set(candidates)];
    const missing = missingFiles(dir, unique);
    if (missing.length === unique.length) {
      // All candidates missing — no build artifacts at all
      failed.push(`${name}: no build artifacts found (checked: ${unique.join(", ")})`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`C09 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C09: All ${pkgs.length} packages have build artifacts`);
}
