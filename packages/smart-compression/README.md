# @orqenix/smart-compression

The orchestrator that turns 4 compression strategies + hooks + telemetry into a single coherent engine (CR v7.1 Chapter 6 + Chapter 15).

## What it does on every call

1. `selectStrategy` chooses among `drop`, `distill`, `compress-chain`, `summarize` based on overshoot ratio (or pinned via `selectionPolicy: 'fixed'`)
2. Fires `preCompress` hook
3. Runs the selected strategy
4. Enforces the **105% overflow cap** from CR v7.1 (throws `OverflowError` if violated)
5. Fires `postCompress` hook
6. Emits counters, histograms, gauges to the optional `MetricsRegistry`

## Token Visibility UX

`summarizeMetrics(registry)` returns a snapshot suitable for CLI rendering (the actual CLI surface lives in Part 12).
`formatRatioBar(ratio)` renders an ASCII bar like `[#####-----] 50%`.

Charter gates: **G14 Hooks**, **G15 Compression Strategies**, **G22 Token Visibility**.
