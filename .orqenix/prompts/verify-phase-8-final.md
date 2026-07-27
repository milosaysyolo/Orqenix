# AGENT TASK, D8.verify-3, Surface real test failures + CI prove + Pro

## Context

D8.verify-2 closed typecheck (99/99) + build (48/48), excellent. But:

- Test step timed out with "130p 12f" repeated on 41 packages (suspicious pattern, no actual error captured)
- Lint failed on 5 packages due to ESLint 9 requiring flat config
- CI Linux + macOS never actually ran, no proof "pre-existing" claim is correct
- Pro repo never verified

This round MUST:

1. Capture EXACT vitest stderr from ONE failing package (no more summaries)
2. Migrate 5 packages to ESLint flat config (eliminates the "pre-existing" lint excuse)
3. Trigger CI on Linux + macOS + Windows and surface the matrix
4. Run Pro repo verify

## Hard rules

1. **No "pre-existing" classification without git blame proof.**
2. **Capture stdout + stderr** with `--reporter=verbose`. No more "130p 12f" without context.
3. **Dependency versions golden rule** still applies.
4. **Phase 8 spec gap detected**, @typescript-eslint/parser + plugin must be pinned to `^8.0.0` (verified published; do not exceed).

## Steps

1. Place all 8 patch files:
   - scripts/verify/capture-test-failures.mjs
   - eslint.config.js (template, used by migration script)
   - scripts/verify/migrate-eslint-flat-config.mjs
   - vitest.config.shared.ts (workspace root)
   - scripts/verify/apply-vitest-shared-config.mjs
   - .github/workflows/trigger-verify-now.yml
   - scripts/verify/check-eslint-flat-only.mjs
   - .orqenix/prompts/verify-phase-8-final.md

2. Run migrations:

```
node scripts/verify/migrate-eslint-flat-config.mjs
node scripts/verify/apply-vitest-shared-config.mjs
node scripts/verify/check-eslint-flat-only.mjs  # must exit 0
pnpm install  # refresh lockfile
```

3. Capture EXACT failure output from memory-engine:

```
node scripts/verify/capture-test-failures.mjs @orqenix/memory-engine
```

Attach test-failure-\_orqenix_memory-engine.json to the next report.

4. Push branch + trigger CI:

```
git push origin phase-8/verify-kit
gh workflow run trigger-verify-now.yml -f branch=phase-8/verify-kit
```

Wait for ALL 3 OS jobs to complete. Capture matrix result.

5. Pro repo:

```
cd ../Orqenix-Pro
node scripts/verify/verify-pro.mjs > ../pro-verify.log 2>&1
```

## Deliverable

Must include:

- test-failure-\_orqenix_memory-engine.json (real stderr)
- CI matrix screenshot or summary: Linux /, macOS /, Windows /
- pro-verify.log
- Lint result after flat config migration: should be `0 errors`
- Statement: "Pre-existing on main branch? <git evidence>"
- Final: ready to tag v0.8.0? YES/NO with reasoning
