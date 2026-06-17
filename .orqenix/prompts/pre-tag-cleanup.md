# AGENT TASK — Pre-Tag Cleanup for v0.8.0

## Context

Phase 8 CORE went through 6 verify cycles. The repo likely has cruft:
debug artifacts, stale dist refs, line ending inconsistencies, lockfile
drift, possibly orphan files. Clean up before tagging v0.8.0.

## Hard rules

1. **No destructive action without dry-run first.** Always run `--dry-run`
   to see what would change.
2. **Never delete source code, tests, or charter-gate fixtures.** The
   cleanup test suite guards these.
3. **If cleanup test fails after a cleanup step, STOP** and report. Do
   not chain further cleanups.
4. **Backup lockfile before regenerating.** `regenerate-lockfile.mjs` does
   this automatically — don't skip.
5. **Verification gates from D8.verify-1 through D8.verify-6 must still
   pass after cleanup.** Run `pnpm run verify` at the end.

## Steps

1. Place all 10 cleanup files at exact paths:
   - scripts/cleanup/scan-cruft.mjs
   - scripts/cleanup/lockfile-audit.mjs
   - scripts/cleanup/verify-workspace-integrity.mjs
   - scripts/cleanup/cleanup.test.mjs
   - scripts/cleanup/clean-debug-artifacts.mjs
   - scripts/cleanup/normalize-line-endings.mjs
   - scripts/cleanup/regenerate-lockfile.mjs
   - scripts/cleanup/cleanup.mjs
   - package.json (root — merge scripts block)
   - .orqenix/prompts/pre-tag-cleanup.md (this file)

2. Baseline scan (no changes):


pnpm run scan:cruft pnpm run scan:lockfile pnpm run scan:workspace pnpm run test:cleanup

Capture all findings.

3. Dry-run the orchestrator:


pnpm run cleanup:dry-run

Surface exactly what would change.

4. Run safe cleanup (debug artifacts + line endings):


pnpm run cleanup:auto

This runs:
- clean-debug-artifacts.mjs (removes *.tmp, test-failure-*.json,
  verify-report.json at root, etc.)
- normalize-line-endings.mjs (CRLF → LF on tracked source files)
- cleanup.test.mjs (verifies nothing essential was removed)

5. If lockfile audit reported drift, regenerate:


pnpm run cleanup:full

This adds lockfile regeneration to the chain. Verify the diff is sensible
(e.g., no major version jumps).

6. Final verification — run the full verify pipeline:


pnpm run verify

This must still pass. If it doesn't, the cleanup broke something — revert
and investigate.

7. Commit cleanup changes:


git add -A git commit -m "chore: pre-tag cleanup for v0.8.0

Remove debug artifacts from verify cycles (D8.verify-1 through -6)
Normalize line endings to LF on source files
Regenerate pnpm-lock.yaml (if --regen-lock was used)
Pass cleanup test suite (workspace integrity, SPDX headers, etc.)"

## Deliverable

Produce a report including:
- `scan-cruft.mjs --json` output (BEFORE cleanup)
- `cleanup.test.mjs` output (AFTER cleanup) — must be all-green
- Diff stats: files changed, insertions, deletions
- `pnpm run verify` final result (must pass)
- List of any items that scan flagged but cleanup did NOT touch (low-priority
follow-ups)
- Final statement: ready to tag v0.8.0? YES/NO

## What this cleanup will NOT do (out of scope, deferred)

- ESLint flat config migration of remaining packages (do this in dedicated PR)
- better-sqlite3 vitest Windows fix (known limitation, documented)
- Empty dir removal (low value, deferred)
- Orphan script removal (some scripts are intentionally not yet wired)
