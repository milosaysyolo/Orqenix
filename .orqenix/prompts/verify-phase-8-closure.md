# AGENT TASK — D8.verify-5 — Final Closure

## Context
D8.verify-4 closed 4 blockers but introduced 3 evidence gaps:
1. **14 reference plugins** classified as "stretch/deferred" — WRONG, they're G70.
2. **CI matrix not re-run** on the fix-4 commits.
3. **vitest binding fix unproven** — no post-fix capture exists.

This round closes these. After this passes, Phase 8 CORE is tag-ready.

## Hard rules
1. **G70 = 14 reference plugins.** They are NOT "stretch", NOT "deferred".
2. **"Pre-existing" claim requires git blame.** No exceptions.
3. **CI matrix must run on the LATEST fix-4 commit.**

## Steps

1. Run reinstate-reference-plugins.mjs to check G70 gate
2. If missing, recreate each plugin from D8.δ spec
3. Verify plugins typecheck + test
4. Run post-fix-capture.mjs for vitest binding proof
5. Force CI re-run (push + dispatch)
6. Write execution report
