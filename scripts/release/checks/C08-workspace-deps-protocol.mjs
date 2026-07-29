/**
 * C08: All @orqenix/* inter-package dependencies use "workspace:*" protocol.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const failed = [];
  const publishedNames = new Set(pkgs);

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const allDeps = { ...(json.dependencies || {}), ...(json.peerDependencies || {}) };
    for (const [dep, version] of Object.entries(allDeps)) {
      if (dep.startsWith("@orqenix/") || dep.startsWith("@orqenix-pro/")) {
        if (version !== "workspace:*") {
          failed.push(`${name} -> ${dep}@${version} (expected workspace:*)`);
        }
      }
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `C08 FAIL: ${failed.length} workspace dep(s) not using workspace:*:\n  ${failed.join("\n  ")}`
    );
  }
  console.log(`  C08: All @orqenix/* deps use workspace:* protocol`);
}
