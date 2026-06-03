# @orqenix/telemetry

Minimal in-memory metrics primitives (counters, gauges, histograms) for the Orqenix Smart Compression Engine and Prompt Rewriter.

## Why no external dependency?

Orqenix runs local-first. Telemetry must be free, offline, and synchronous to feed the **Token Visibility UX** (CR v7.1 Ch.15). Callers wanting Prometheus / OpenTelemetry export wire their own sink via `setSink()`.

## Canonical metric names (METRIC_NAMES)

- `orqenix.compress.tokens_in`, `orqenix.compress.tokens_out`, `orqenix.compress.ratio`
- `orqenix.compress.duration_ms`, `orqenix.compress.tier0_preserved`
- `orqenix.distill.entries_scanned`, `orqenix.distill.memories_created`
- `orqenix.recall.duration_ms`

Charter gates: **G14 Hooks** (shared), **G22 Token Visibility**.
