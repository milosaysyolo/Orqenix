# AGENT TASK: Verify Phase 8 CORE runs 100% (cross-platform)

## Context
Phase 8 CORE (D8.α + D8.β + D8.γ + D8.δ = 566 files) was created from spec.
D8.verify-1 proved typecheck + build are green and the dependency layer is
correct. This round closes the last two gates:
1. **Cross-platform native bindings** (better-sqlite3, esbuild, @swc/core)
   must load on Linux + macOS + Windows.
2. **Test gate** must be green for ALL Phase 8 packages (legacy non-Phase-8
   packages like `@orqenix/core` are excluded by design).

## Hard rules (do NOT violate)
1. **Dependency versions**: a range must NEVER require higher than published.
   `pnpm run check:deps` must exit 0.
2. **vitest + @vitest/ui share the same major.**
3. **`pnpm.onlyBuiltDependencies` allowlist** in root package.json is the ONLY
   way packages may run install scripts. Adding to it is allowed (with reason).
4. **No fake passes**: do not mock SQLite to make tests pass. If a binding
   fails, fix the binding (or document why the platform is unsupported).
5. Keep clean semver. Target tag: **v0.8.0** (no `-phase-8` suffix).

## Steps (OSS repo)

1. Place the 9 patch files at exact paths:
   - .npmrc (root)
   - package.json (root, merge the pnpm + scripts blocks)
   - scripts/verify/check-native-bindings.mjs
   - scripts/verify/rebuild-native.mjs
   - scripts/verify/test-gate.mjs
   - scripts/verify/verify-phase-8.mjs (apply Step 1.5 + Step 5 patches)
   - .github/workflows/verify-phase-8-full.yml (replace)
   - docs/troubleshooting/better-sqlite3-binding.md
   - .orqenix/prompts/verify-phase-8.md (this file)

2. Apply dependency fixes + ensure scripts (idempotent):

   ```bash
   node scripts/verify/fix-dep-versions.mjs
   node scripts/verify/ensure-package-scripts.mjs
   ```

3. Reinstall with the new allowlist:

   ```bash
   pnpm install
   ```

4. Verify native bindings load:

   ```bash
   pnpm run check:native
   ```

   If FAIL -> `pnpm run rebuild:native` -> re-check. If still failing, consult
   docs/troubleshooting/better-sqlite3-binding.md for your OS.

5. Run the full verification:

   ```bash
   pnpm run verify
   ```

   Expected: all 8 steps PASS (native-bindings, typecheck, lint, test, build,
   stub-wiring).

6. CI multi-OS: push the branch. The `verify-phase-8-full` workflow runs on
   Linux + macOS + Windows. ALL three must pass before merge.

## Steps (Pro repo)

7. In Orqenix-Pro (with Orqenix checked out as sibling `../Orqenix`):

   ```bash
   node scripts/verify/verify-pro.mjs
   ```

## Deliverable

Produce an execution report including:
- `pnpm run check:native` output (per OS if you can test locally)
- `verify-report.json` summary
- `test-report.json` summary (scope = phase-8-only)
- CI run links for Linux + macOS + Windows
- Per-package matrix: typecheck / test / build (✅/❌)
- Final statement: ready to tag v0.8.0? YES/NO

## Known fixes baked into this patch

- `pnpm.onlyBuiltDependencies` allowlist added (root) so better-sqlite3 can run
its prebuild-install script.
- `.npmrc` sets `node-linker=hoisted` so the bindings package can find the
native .node file.
- `postinstall` runs `check:native --auto-rebuild` (non-fatal) to auto-recover
after install on a fresh machine.
- Test gate defaults to **Phase 8 scope only** (excludes legacy `@orqenix/core`)
so a pre-existing native binding issue in legacy code does not block release.
- CI matrix runs on 3 OSes to prove cross-platform.

## DO NOT do this

- Do not add `--ignore-scripts` to install commands, the allowlist is the
right gate.
- Do not change better-sqlite3 to `^12`, Phase 5+ work was done against
`^11.5.0` and CR v8.0 pins it (only bump in a dedicated PR with full retest).
- Do not delete `@orqenix/core` to "fix" the legacy test, it predates Phase 8
and is scoped out by `test-gate.mjs --phase-8-only`.
