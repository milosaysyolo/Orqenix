# AGENT TASK — Post-Merge Cross-Phase Verification

## Context

main diverged far before merging phase-8/verify-kit. Verify ALL features
Phase 1 → Phase 8 still work after the merge. Fix any break immediately.

## Hard rules

1. A failing PHASE test = that phase's feature broke. Fix the root cause, do not skip.
2. A failing SEAM test = the integration BETWEEN two phases broke. This is the highest-risk class, fix the contract, do not loosen the test.
3. Migration ordering test is FATAL — if migrations don't apply in order or IDs collide, the schema is corrupt. Fix before anything else.
4. No "pre-existing" without git blame.

## Steps

1. Place all 12 merge-verify files at exact paths (scripts/merge-verify/_ and tests/merge-verify/_).
2. Resolve any git conflict markers first: `pnpm run merge-verify:conflicts`
3. Run the full cross-phase verification: `pnpm run merge-verify`
4. For each failed phase/seam, fix the root cause + re-run that single test: `pnpm vitest run tests/merge-verify/<failed>.test.ts`
5. Re-run full suite until all phases + seams pass.

## Deliverable

- merge-verify-report.json (all phases + seams)
- Per-phase matrix: Phase 1-2/3/4/5/6/7/8 OK/FAIL
- Per-seam matrix: 4 seams OK/FAIL
- Migration ordering: OK (all tables present, no ID collision)
- List of any contract drift found + how fixed
- Final: all Phase 1→8 features verified post-merge? YES/NO
