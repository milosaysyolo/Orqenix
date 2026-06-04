# Agent Task: Diagnose and Fix plugin-semantic-cache Test Race

## Context

@orqenix/plugin-semantic-cache test intermittently fails on CI (observed
ubuntu node20, github-ci-6-4.3 run 26935088845). Passes on re-run. Classic
race condition. A temporary mitigation (singleThread + retry:3) is in place
in packages/plugin-semantic-cache/vitest.config.ts but the root cause must
be eliminated.

## Goal

Find and fix the race at its source. Then lower retry from 3 to 1 (keep
retry:1 only as defense-in-depth, not as the fix).

## Investigation Steps

1. Reproduce locally by running the test many times:
   ```bash
   cd packages/plugin-semantic-cache
   FAILS=0
   for i in $(seq 1 50); do
     if ! pnpm test >/tmp/run-$i.log 2>&1; then
       FAILS=$((FAILS+1))
       echo "Run $i FAILED"
     fi
   done
   echo "Total failures: $FAILS / 50"
   # Inspect a failed run
   grep -l "FAIL\|AssertionError" /tmp/run-*.log | head -1 | xargs cat
   ```

2. Common race sources to check in semantic-cache:
   - Shared cache directory or temp file between tests without afterEach cleanup
   - Async cache write not awaited before a read assertion
   - TTL/expiry timers using real clock instead of vi.useFakeTimers()
   - Concurrent cache key collisions across test cases
   - Module-level singleton cache instance leaking state between tests
   - Embedding similarity threshold tests depending on float timing

3. Grep for suspicious patterns:
   ```bash
   grep -rn "setTimeout\|setInterval" src/ test/
   grep -rn "new SemanticCache\|getInstance\|singleton" src/ test/
   grep -rn "beforeEach\|afterEach" test/
   grep -rn "await" test/ | wc -l   # compare to number of cache ops
   ```

## Fix Patterns

- Wrap any TTL/expiry test with vi.useFakeTimers() and advance time explicitly
- Give each test its own cache instance + unique temp dir, clean up in afterEach
- Await every async cache set before asserting a get
- Reset any singleton/module state in beforeEach
- If similarity threshold is timing-dependent, make the comparison deterministic

## Deliverable

1. Root cause written into the PR description
2. Source fix (not just retry)
3. Lower retry:3 to retry:1 in vitest.config.ts
4. Run the 50x loop again and confirm 0 failures
5. Report at .orqenix/reports/semantic-cache-race-fix-YYYY-MM-DD.md

## Denied Actions

- Do not just increase retry count and call it fixed.
- Do not skip or .skip the test.
- Do not disable parallelism globally (only this package, already done).
- Do not weaken assertions to make the test pass.
