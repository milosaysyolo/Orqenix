# AGENT TASK , D8.verify-4 , Close the 4 REAL blockers

## Context

D8.verify-3 claimed "ready to tag v0.8.0" but the review identified 5 sai l\u1ec7ch:

1. Workbench (G61) classified as "Phase 7 legacy" , WRONG, it's D8.alpha.1
2. ui-primitives "Phase 8 excludes UI" , WRONG, it's D8.alpha.2
3. self-learning-advanced "pre-existing" , WRONG, it shipped in D8.gamma Part 6
4. Pro repo verified on v0.5.0 , WRONG REPO/version (Phase 8 Pro is v0.8.0)
5. better-sqlite3 vitest fail still hand-waved as "pre-existing"

This round closes these. NO more "pre-existing" without git blame.

## Hard rules

1. **"Pre-existing" requires git blame proof.** Run `verify-pre-existing-claim.mjs`
   to validate every such claim. If `main` branch doesn't have the same failure,
   it's a Phase 8 regression , fix it.
2. **Phase 8 scope is LOCKED.** `scope-gate.mjs` defines the 41 OSS + 2 Pro
   packages. ALL must pass typecheck. No scope re-definition.
3. **Pro repo must be Phase 8 (v0.8.0), not Phase 5.** `verify-pro-v8.mjs` does
   pre-flight to ensure correct branch + version.
4. **Dependency versions golden rule.**

## Steps

1. Place 8 patch files:
   - scripts/verify/verify-pre-existing-claim.mjs
   - apps/workbench/package.json (REPLACE)
   - packages/ui-primitives/package.json (REPLACE , remove tailwindcss-animate drift)
   - packages/self-learning-advanced/package.json (REPLACE , in Pro repo)
   - vitest.config.shared.ts (REPLACE , workspace root)
   - scripts/verify/verify-pro-v8.mjs (place in Pro repo)
   - scripts/verify/scope-gate.mjs
   - .orqenix/prompts/verify-phase-8-final-v2.md

2. Validate scope: `node scripts/verify/scope-gate.mjs`

3. Refresh + verify: `pnpm install && pnpm -r run typecheck`
   Workbench typecheck MUST now pass (next-themes + workspace deps added).
   ui-primitives build MUST pass (no tailwindcss-animate dep).

4. If still failing on a Phase 8 package, run:
   `node scripts/verify/verify-pre-existing-claim.mjs`

5. Pro repo: `cd ../Orqenix-Pro && git checkout phase-8/self-learning-pro && node scripts/verify/verify-pro-v8.mjs`

6. CI matrix: `gh workflow run verify-phase-8-full.yml -f branch=phase-8/verify-kit`

## Deliverable

- `pnpm -r run typecheck` showing workbench INCLUDED and PASSING
- `pnpm -r run build` showing ui-primitives PASSING
- `verify-pro-v8.mjs` output showing v0.8.0 Pro packages, all green
- CI matrix: Linux + macOS + Windows, typecheck step OK for ALL Phase 8 packages
- `verify-pre-existing-claim.mjs` output: 0 violations
- Final statement: ready to tag v0.8.0? YES/NO with NO scope exclusions
