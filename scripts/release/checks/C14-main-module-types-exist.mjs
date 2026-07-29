/**
 * C14: main, module, and types fields point to files that exist on disk.
 */
import { loadWhitelist, loadPackage, missingFiles } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { dir, json } = loadPackage(name);
    const checks = [];
    if (json.main) checks.push({ field: "main", path: json.main });
    if (json.module) checks.push({ field: "module", path: json.module });
    if (json.types) checks.push({ field: "types", path: json.types });

    for (const { field, path } of checks) {
      const missing = missingFiles(dir, [path]);
      if (missing.length > 0) {
        failed.push(`${name}: "${field}" -> ${path} (file not found)`);
      }
    }
  }

  if (failed.length > 0) {
    throw new Error(`C14 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C14: All ${pkgs.length} packages have valid main/module/types paths`);
}
