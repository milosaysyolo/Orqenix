// SPDX-License-Identifier: Apache-2.0
// Detects whether native bindings (better-sqlite3, esbuild, @swc/core) are
// loadable on the current platform. Reports clear errors. With --auto-rebuild,
// attempts to rebuild the missing binding without failing the install.
//
// Run:
//   node scripts/verify/check-native-bindings.mjs
//   node scripts/verify/check-native-bindings.mjs --auto-rebuild
//   node scripts/verify/check-native-bindings.mjs --json

import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const autoRebuild = args.includes("--auto-rebuild");
const jsonOut = args.includes("--json");

const NATIVE_DEPS = ["better-sqlite3", "esbuild", "@swc/core"];

function platformInfo() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    abi: process.versions.modules,
  };
}

/** Attempts to require a package; returns { ok, error } */
function probe(name) {
  // Resolve from ROOT so we use the hoisted node_modules
  const probeScript = `
    try {
      const m = require('${name}');
      // For better-sqlite3, instantiate to force binding load
      ${
        name === "better-sqlite3"
          ? `const db = new m(':memory:'); db.exec('SELECT 1'); db.close();`
          : `void m;`
      }
      process.stdout.write('OK');
    } catch (err) {
      process.stdout.write('FAIL:' + (err.code || '') + ':' + err.message);
    }
  `;
  const result = spawnSync(process.execPath, ["-e", probeScript], {
    cwd: ROOT,
    encoding: "utf-8",
    timeout: 15000,
  });
  const out = (result.stdout ?? "").trim();
  if (out === "OK") return { ok: true };
  return {
    ok: false,
    error: out.startsWith("FAIL:") ? out.slice(5) : `unknown (exit ${result.status})`,
  };
}

function tryRebuild(name) {
  console.log(`  → Attempting rebuild of ${name}...`);
  // Use pnpm rebuild which respects the workspace + onlyBuiltDependencies allowlist
  const r = spawnSync("pnpm", ["rebuild", name], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    timeout: 120000,
  });
  if (r.status === 0) {
    console.log(`  ✓ ${name} rebuilt successfully`);
    return true;
  }
  console.warn(`  ✗ pnpm rebuild ${name} failed (exit ${r.status})`);
  // Fallback: try direct npm rebuild from source
  if (name === "better-sqlite3") {
    console.log(`  → Fallback: npm rebuild better-sqlite3 --build-from-source...`);
    const r2 = spawnSync("npm", ["rebuild", "better-sqlite3", "--build-from-source"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      timeout: 300000,
    });
    if (r2.status === 0) {
      console.log(`  ✓ better-sqlite3 built from source`);
      return true;
    }
  }
  return false;
}

const info = platformInfo();
const results = {};

if (!jsonOut) {
  console.log("Native binding diagnostic");
  console.log("  Node:     " + info.node);
  console.log("  Platform: " + info.platform + "/" + info.arch);
  console.log("  ABI:      " + info.abi + "\n");
}

let allOk = true;
for (const dep of NATIVE_DEPS) {
  if (!existsSync(join(ROOT, "node_modules", dep))) {
    results[dep] = { ok: false, error: "NOT_INSTALLED", skipped: true };
    if (!jsonOut) console.log(`  ⏭  ${dep} not installed (skipped)`);
    continue;
  }
  const r = probe(dep);
  results[dep] = r;
  if (!jsonOut) {
    if (r.ok) {
      console.log(`  ✅ ${dep} loads correctly`);
    } else {
      console.log(`  ❌ ${dep} FAILED: ${r.error}`);
      if (autoRebuild) {
        const rebuilt = tryRebuild(dep);
        if (rebuilt) {
          const r2 = probe(dep);
          results[dep] = r2;
          if (r2.ok) {
            console.log(`  ✅ ${dep} now loads after rebuild`);
            continue;
          }
        }
      }
      allOk = false;
    }
  }
}

if (jsonOut) {
  process.stdout.write(JSON.stringify({ platform: info, results }, null, 2) + "\n");
} else {
  console.log(
    allOk
      ? "\n✅ All native bindings load correctly."
      : "\n❌ One or more native bindings cannot load.",
  );
  if (!allOk && !autoRebuild) {
    console.log("   → Run `pnpm run rebuild:native` to attempt a fix.");
  }
}

// Exit 0 unless autoRebuild mode was requested AND something still failed.
// Without auto-rebuild, this is purely diagnostic (don't break install).
process.exit(autoRebuild && !allOk ? 1 : 0);
