/**
 * C15: All entries in the "files" array exist on disk.
 * Skips "dist" directory — it's tested separately in C09.
 * ponytail: if C09 is removed/renamed, this check silently stops covering dist.
 *           Either remove the skip or make the dependency explicit via check metadata.
 */
import { loadWhitelist, loadPackage, missingFiles } from "./_helpers.mjs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { dir, json } = loadPackage(name);
    const files = json.files || [];

    for (const entry of files) {
      if (entry === "dist") continue; // checked by C09
      const resolved = resolve(dir, entry);
      if (!existsSync(resolved)) {
        failed.push(`${name}: files entry "${entry}" not found on disk`);
      }
    }
  }

  if (failed.length > 0) {
    throw new Error(`C15 FAIL:\n  ${failed.join("\n  ")}`);
  }
  console.log(`  C15: All ${pkgs.length} packages have valid files entries`);
}
