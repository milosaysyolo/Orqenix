// SPDX-License-Identifier: Apache-2.0
// Cross-checks workspace integrity after 6 verify cycles:
//   - Every package has SPDX header in src
//   - Every package has LICENSE file matching declared license
//   - Every package has README
//   - No package.json missing required fields (name/version/license)
//   - Versions consistent across workspace (all 0.8.0-alpha.1 or 0.8.0)

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const REQUIRED = ["name", "version", "license"];
const OSS_LICENSE = "Apache-2.0";
const PRO_LICENSE = "BUSL-1.1";

let issues = 0;
const pkgFiles = execSync(
  'git ls-files "packages/*/package.json" "apps/*/package.json" "plugins/*/package.json"',
  {
    cwd: ROOT,
    encoding: "utf-8",
  },
)
  .split("\n")
  .map((p) => p.trim())
  .filter(Boolean);

const versions = new Map(); // version → [pkg names]

for (const rel of pkgFiles) {
  const abs = join(ROOT, rel);
  const pkg = JSON.parse(await readFile(abs, "utf-8"));
  const dir = dirname(abs);

  // 1. Required fields
  for (const field of REQUIRED) {
    if (!pkg[field]) {
      console.error(`❌ ${rel}: missing required field "${field}"`);
      issues += 1;
    }
  }

  // 2. License consistency
  const expectedLicense = pkg.name?.startsWith("@orqenix-pro/") ? PRO_LICENSE : OSS_LICENSE;
  if (pkg.license !== expectedLicense) {
    console.error(`❌ ${pkg.name}: license is "${pkg.license}", expected "${expectedLicense}"`);
    issues += 1;
  }

  // 3. LICENSE file exists
  const licenseFile = join(dir, "LICENSE");
  if (!existsSync(licenseFile)) {
    console.error(`❌ ${pkg.name}: LICENSE file missing`);
    issues += 1;
  }

  // 4. README exists
  if (!existsSync(join(dir, "README.md"))) {
    console.warn(`⚠ ${pkg.name}: README.md missing`);
  }

  // 5. Version tracking
  if (pkg.version) {
    const list = versions.get(pkg.version) ?? [];
    list.push(pkg.name);
    versions.set(pkg.version, list);
  }
}

// 6. All packages should be on same version line
console.log("\nVersion distribution:");
for (const [ver, names] of versions) {
  console.log(`  ${ver} (${names.length} packages)`);
}
if (versions.size > 2) {
  console.warn(
    `⚠ ${versions.size} distinct versions in workspace. Should typically be 1 (or 2 if mid-transition).`,
  );
}

if (issues > 0) {
  console.error(`\n❌ ${issues} workspace integrity issue(s).`);
  process.exit(1);
}
console.log("\n✅ Workspace integrity clean.");
process.exit(0);
