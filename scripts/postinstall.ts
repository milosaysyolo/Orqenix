/**
 * Postinstall guard.
 * Fails install on Node < 20. Warns on > 22 (not yet tested in CI matrix).
 * Warns on missing optional native build tools on Windows.
 */

const versions = process.versions.node.split(".").map(Number);
const major = versions[0] ?? 0;

if (major < 20) {
  console.error(
    `[orqenix] Node ${process.versions.node} is unsupported. Please use Node 20 LTS or later.`,
  );
  process.exit(1);
}

if (major > 22) {
  console.warn(
    `[orqenix] Node ${process.versions.node} is newer than the CI test matrix (20, 22). ` +
      `Things should work, but please report any issues.`,
  );
}

if (process.platform === "win32") {
  // better-sqlite3 needs MSVC + Python on Windows when no prebuilt binary exists for the Node major.
  // We only warn — the actual build error from node-gyp is descriptive enough.
  const hint = [
    "[orqenix] Windows detected. If `pnpm install` fails on better-sqlite3:",
    "  1. Install Visual Studio Build Tools 2022 with the C++ workload",
    "  2. Install Python 3.x and ensure it's on PATH",
    "  3. Run: npm config set msvs_version 2022",
    "  See https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md",
  ].join("\n");
  console.log(hint);
}
