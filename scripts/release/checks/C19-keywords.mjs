/**
 * C19: keywords array exists and is non-empty for better npm discoverability.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const kw = json.keywords;
    if (!kw || !Array.isArray(kw) || kw.length === 0) {
      failed.push(name);
    }
  }

  if (failed.length > 0) {
    console.warn(
      `  C19 WARN: ${failed.length} package(s) missing keywords array:\n    ${failed.join(", ")}`,
    );
  } else {
    console.log(`  C19: All ${pkgs.length} packages have keywords`);
  }
}
