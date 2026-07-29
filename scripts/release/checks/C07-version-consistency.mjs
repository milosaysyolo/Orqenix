/**
 * C07: All publishable packages share the same version number.
 */
import { loadWhitelist, loadPackage } from "./_helpers.mjs";

export async function run() {
  const pkgs = loadWhitelist();
  const versions = new Map(); // version -> [names]
  const errors = [];

  for (const name of pkgs) {
    const { json } = loadPackage(name);
    const ver = json.version;
    if (!ver) {
      errors.push(`${name}: missing "version" field`);
      continue;
    }
    if (!versions.has(ver)) versions.set(ver, []);
    versions.get(ver).push(name);
  }

  if (errors.length > 0) {
    throw new Error(`C07 FAIL:\n  ${errors.join("\n  ")}`);
  }

  if (versions.size > 1) {
    const lines = [];
    for (const [ver, names] of versions) {
      lines.push(`  v${ver} (${names.length} packages): ${names.join(", ")}`);
    }
    throw new Error(`C07 FAIL: ${versions.size} different versions found:\n${lines.join("\n")}`);
  }

  const [commonVer] = versions.keys();
  console.log(`  C07: All ${pkgs.length} packages at version ${commonVer}`);
}
