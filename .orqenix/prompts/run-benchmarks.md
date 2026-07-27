# AGENT TASK , Run Orqenix Performance Benchmarks (Phase 1 → 8)

## Context
The bench kit measures latency (p50/p95/p99), throughput (ops/sec), and memory
for every major feature Phase 1 → Phase 8. SLO targets derive from CR v8.0
(<300ms cross-scope query, <10ms capability verify, <200ms distill).

## Hard rules
1. Run with `--expose-gc` so memory deltas are clean.
2. Build all dependency packages first (bench imports their dist).
3. Run on a quiet machine (no other heavy processes) for stable numbers.
4. Do NOT change SLO targets to make benchmarks pass. If a target fails,
   report the real number + investigate the regression.

## Steps
1. Place all 16 bench files at exact paths (packages/bench/**).
2. Build dependencies + bench:

   ```bash
   pnpm install
   pnpm -r --filter "@orqenix/*" run build
   pnpm --filter @orqenix/bench run bench   # --expose-gc auto via script
   ```

   This writes bench-results.json + prints the per-phase table with SLO flags.

3. Generate the Markdown report:

   ```bash
   pnpm --filter @orqenix/bench run bench:report > BENCHMARK-REPORT.md
   ```

4. Establish a baseline (first run only):

   ```bash
   cp bench-results.json bench-baseline.json
   git add bench-baseline.json
   ```

5. On subsequent runs, gate regressions:

   ```bash
   pnpm --filter @orqenix/bench run bench:gate
   ```

## Deliverable
- bench-results.json (raw)
- BENCHMARK-REPORT.md (formatted, per-phase tables)
- The 3 CR v8.0 quality target results: hierarchy<300ms, permission.exact<10ms,
  permission.prefix<10ms , each PASS/FAIL with actual p95
- Any SLO violation: benchmark name + actual p95 vs target + hypothesis
- Final statement: are all Phase 1→8 features within performance budget? YES/NO
