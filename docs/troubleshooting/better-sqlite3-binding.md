# Troubleshooting: better-sqlite3 native binding

## Symptoms

```
Error: Could not locate the bindings file. Tried:
  → /path/to/node_modules/better-sqlite3/build/better_sqlite3.node
  → /path/to/node_modules/better-sqlite3/build/Release/better_sqlite3.node
  ...
```

## Quick fix

```bash
pnpm run rebuild:native
pnpm run check:native
```

## Why this happens

`better-sqlite3` ships **prebuilt binaries** for every Node LTS × OS × arch
combination. When you run `pnpm install`, the package's install script
(`prebuild-install`) downloads the right binary for your platform.

Two things can break this in an Orqenix workspace:

### 1. `ignore-scripts=true` without the allowlist

Orqenix has `ignore-scripts=true` in `.npmrc` (security policy from Phase 5).
This means NO package can run install scripts by default.

The fix is the **allowlist** in root `package.json`:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["better-sqlite3", "esbuild", "@swc/core"]
  }
}
```

If this is missing, the prebuilt binary is never downloaded.

### 2. `node-linker=isolated` (pnpm default)

pnpm's default isolated linker nests `better-sqlite3` deep inside the workspace,
and the `bindings` package can't find the native `.node` file via its standard
lookup. Switching to `node-linker=hoisted` in `.npmrc` puts it at a path
`bindings()` understands.

## Manual fixes by OS

### Linux

```bash
# Prebuilt binary should work. If not, install build deps + rebuild:
sudo apt-get install -y build-essential python3
pnpm rebuild better-sqlite3
```

### macOS

```bash
# Xcode CLT is required for source builds (prebuilds are usually enough):
xcode-select --install
pnpm rebuild better-sqlite3
```

### Windows

Prebuilt binaries cover MOST cases. If you need a source build:

```powershell
# Install build tools + Python (one-time):
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
# https://www.python.org/downloads/

# Then rebuild:
pnpm rebuild better-sqlite3

# Last resort: build from source explicitly
npm rebuild better-sqlite3 --build-from-source
```

## Verifying it works

```bash
node scripts/verify/check-native-bindings.mjs
```

Expected output:

```
✅ better-sqlite3 loads correctly
✅ esbuild loads correctly
✅ @swc/core loads correctly
✅ All native bindings load correctly.
```

## CI

CI runs the multi-OS matrix in `.github/workflows/verify-phase-8-full.yml`
(Linux + macOS + Windows). Every push to a `phase-8/**` branch verifies all
three platforms.

## Why this matters for v0.8.0

Users install Orqenix on Linux, macOS, AND Windows. If better-sqlite3 doesn't
load cleanly on any of these, the local-first Workbench (memory.db) cannot
open and the app is broken at launch. Catching this in CI before tagging
v0.8.0 is non-negotiable.
