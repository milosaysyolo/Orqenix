# AGENT TASK: Verify Phase 8 CORE runs 100% (install + typecheck + test + build)

## Context
Phase 8 CORE (D8.α + D8.β + D8.γ + D8.δ = 566 files) was created file-by-file
from spec but NEVER installed, typechecked, tested, or built. Your job is to make
it actually run, fix only what blocks compilation/tests, and report results.

## Repos
- OSS:  milosaysyolo/Orqenix       (branch: create `phase-8/verify-kit` from the
        merged phase-8 branches, or run on the integration branch)
- Pro:  milosaysyolo/Orqenix-Pro   (branch: phase-8/self-learning-pro)

## Hard rules (do NOT violate)
1. **Dependency versions**: a dependency range must NEVER require a version
   higher than what npm actually publishes. Run `node scripts/verify/check-dep-versions.mjs`
   and fix any violation by LOWERING the range to a published version. Never bump
   a range above latest just to make something resolve.
2. **vitest and @vitest/ui MUST share the same major.** If you bump one, bump both.
3. Keep clean semver. The target tag is **v0.8.0** (no `-phase-8` suffix).
4. Do NOT rewrite business logic. Fix only: import paths, missing exports,
   type errors, missing devDeps, missing package scripts. If a fix changes
   behavior, STOP and report instead.
5. Apache-2.0 SPDX header stays on every OSS file; BSL-1.1 on every Pro file.

## Step-by-step (OSS repo first)

1. Place the 9 verification files exactly at these paths:
   - scripts/verify/fix-dep-versions.mjs
   - scripts/verify/check-dep-versions.mjs
   - scripts/verify/verify-phase-8.mjs
   - scripts/verify/check-stub-wiring.mjs
   - scripts/verify/ensure-package-scripts.mjs
   - pnpm-workspace.yaml            (merge if it already exists)
   - package.json                   (root: merge scripts + devDependencies)
   - .github/workflows/verify-phase-8-full.yml
   - .orqenix/prompts/verify-phase-8.md   (this file)

2. Apply dependency fixes + ensure scripts:
   ```
   node scripts/verify/fix-dep-versions.mjs
   node scripts/verify/ensure-package-scripts.mjs
   ```

3. Run the full verification:
   ```
   pnpm run verify
   ```
   This runs: dep-version sanity → workspace integrity → install → typecheck →
   lint → test → build → stub-wiring. It writes verify-report.json.

4. For EACH failing package (typecheck/test/build), fix the minimal blocker:
   - Missing devDep (e.g., @vitejs/plugin-react for ui-primitives tests, tailwind
     for build:css) → add it at a PUBLISHED version (verify with check-dep-versions).
   - Missing export / wrong import path → correct it.
   - `@orqenix/csf` referenced but not a real package → it lives inside
     @orqenix/plugin-core; update imports to `@orqenix/plugin-core` (or its
     `/csf` subpath export) and re-run.
   - Type error from an unwired stub → wire it minimally per the D8.α.6 pattern,
     do not change the contract.
   Re-run `pnpm run verify:fast` after each fix until typecheck + test are green,
   then run full `pnpm run verify`.

5. Lockfile: after fixes, commit the regenerated `pnpm-lock.yaml`.

## Step-by-step (Pro repo)

6. In Orqenix-Pro, ensure the OSS repo is checked out as a sibling (../Orqenix)
   per the Phase 7 unified cross-repo checkout. Place
   scripts/verify/verify-pro.mjs and run:
   ```
   node scripts/verify/verify-pro.mjs
   ```
   Fix Pro blockers the same way (deps point at OSS workspace packages).

## Deliverable (report back)
Produce an execution report with:
- The exact `verify-report.json` summary (steps + pass/fail + durations).
- A table of every fix applied: file, before → after, reason.
- Confirmation that `check-dep-versions.mjs` exits 0 (no over-specified ranges).
- Per-package matrix: typecheck ✅/❌, test ✅/❌ (with test counts), build ✅/❌.
- Any package that could NOT be made green, with the exact error + your hypothesis.
- Final statement: is Phase 8 CORE ready to tag v0.8.0? YES/NO + blockers if NO.

## Known likely blockers (heads-up, fix when hit)
- ui-primitives build:css needs tailwindcss + autoprefixer + @vitejs/plugin-react
  (the D8.α.2 report added tailwind.config.js + postcss.config.js: verify deps).
- Workbench (Next 15) build needs `next build` + standalone output + favicon.ico
  (placeholder noted in D8.α.1 report: a 1x1 transparent .ico is fine for build).
- @modelcontextprotocol/sdk import paths: SDK v1.25+: confirm server/stdio import
  paths match the installed version's exports.
- better-sqlite3 native build: CI runner needs build tools; prebuilt binaries
  exist for Node 20 LTS (the pinned engine).
- memory-engine tests use `:memory:` SQLite: no file IO, should pass on CI.
