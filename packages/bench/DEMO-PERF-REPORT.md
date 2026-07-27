# Orqenix Demo Performance Report

> Generated: 2026-07-24T11:47:21.833Z
> Environment: Node v24.18.0 · win32/x64 · GC enabled
> Total wall time: 12.7s

## Executive Summary

| Metric | Value |
|---|---|
| Benchmarks | 23 |
| SLO-enforced | 23 |
| SLO passing | 23/23 |
| SLO violations | 0 |
| Wall time | 12.7s |

## Phase-by-Phase Results

### Phase 1-2 (Memory Core)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| memory.write.inline | 0.108 | 0.174 | 0.320 | 8,123 | 4.07 | 8.02 | PASS |
| memory.write.blob | 0.305 | 0.549 | 0.609 | 3,007 | 5.20 | 11.13 | PASS |
| memory.fetch.inline | 0.006 | 0.007 | 0.042 | 140,067 | 5.75 | 13.00 | PASS |

### Phase 3 (Storage)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| blake3.hash.1kb | 0.017 | 0.022 | 0.050 | 54,767 | 5.85 | 0.59 | PASS |
| blake3.hash.64kb | 1.081 | 1.208 | 1.305 | 902 | 6.35 | 0.11 | PASS |
| blob.put.new | 0.028 | 0.049 | 0.087 | 29,825 | 4.25 | 3.02 | PASS |
| blob.put.dedup | 0.099 | 0.127 | 0.301 | 9,413 | 4.29 | 1.03 | PASS |

### Phase 4 (Search)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| cosine.384dim | 0.001 | 0.001 | 0.001 | 1,596,796 | 4.20 | -0.54 | PASS |
| search.1k | 1.886 | 2.307 | 2.581 | 512 | 32.39 | 31.83 | PASS |
| search.10k | 2.955 | 3.582 | 4.006 | 330 | 28.37 | 0.36 | PASS |

### Phase 5 (Capability)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| permission.exact | 0.000 | 0.000 | 0.000 | 6,903,169 | 8.97 | 3.08 | PASS |
| permission.prefix | 0.000 | 0.000 | 0.001 | 3,260,558 | 14.81 | 0.91 | PASS |
| manifest.validate | 0.008 | 0.027 | 0.042 | 89,307 | 28.52 | 0.79 | PASS |

### Phase 7 (Audit Chain)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| audit.append | 0.099 | 0.145 | 0.207 | 9,010 | 22.06 | 9.57 | PASS |
| audit.verify.100 | 1.750 | 2.079 | 2.413 | 553 | 11.96 | -2.25 | PASS |
| audit.verify.1000 | 17.036 | 20.976 | 25.213 | 57 | 51.28 | 65.46 | WARN (high heap) |

### Phase 8 (Hierarchy/Branch/Subagent)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| hierarchy.query.3level | 1.843 | 2.010 | 4.002 | 522 | 51.03 | -4.20 | WARN (high heap) |
| branch.deepcopy.1k | 27.246 | 28.624 | 98.045 | 33 | 31.87 | 109.82 | PASS |
| subagent.invoke.absorb | 0.258 | 0.350 | 0.403 | 3,555 | 5.91 | 18.96 | PASS |

### Phase 8 (Normalization)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| normalize.roundtrip.npm | 0.024 | 0.027 | 0.045 | 40,327 | 32.58 | 0.00 | PASS |
| normalize.import.autodetect | 0.451 | 0.750 | 1.027 | 2,021 | 41.63 | 0.61 | PASS |

### Phase 8 (Self-Learning)

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| selflearning.detect.1k | 0.552 | 0.847 | 1.017 | 1,711 | 53.37 | 0.02 | WARN (high heap) |

### Migration

| Benchmark | p50 (ms) | p95 (ms) | p99 (ms) | ops/sec | Heap Δ (MB) | RSS Δ (MB) | Evaluation |
|---|---|---|---|---|---|---|---|
| migration.apply.all | 3.602 | 3.852 | 4.056 | 275 | 2.61 | 0.00 | PASS |

## Evaluation Matrix

| Benchmark | SLO Target | Actual p95 | Headroom | Assessment |
|---|---|---|---|---|
| memory.write.inline | <2ms | 0.174ms | 91.3% | ✅ excellent |
| memory.write.blob | <5ms | 0.549ms | 89.0% | ✅ excellent |
| memory.fetch.inline | <1ms | 0.007ms | 99.3% | ✅ excellent |
| blake3.hash.1kb | <0.5ms | 0.022ms | 95.6% | ✅ excellent |
| blake3.hash.64kb | <2ms | 1.208ms | 39.6% | ✅ OK |
| blob.put.new | <3ms | 0.049ms | 98.4% | ✅ excellent |
| blob.put.dedup | <1ms | 0.127ms | 87.3% | ✅ excellent |
| cosine.384dim | <0.05ms | 0.001ms | 98.6% | ✅ excellent |
| search.1k | <25ms | 2.307ms | 90.8% | ✅ excellent |
| search.10k | <120ms | 3.582ms | 97.0% | ✅ excellent |
| permission.exact | <0.01ms | 0.000ms | 98.0% | ✅ excellent |
| permission.prefix | <0.05ms | 0.000ms | 99.2% | ✅ excellent |
| manifest.validate | <2ms | 0.027ms | 98.7% | ✅ excellent |
| audit.append | <3ms | 0.145ms | 95.2% | ✅ excellent |
| audit.verify.100 | <30ms | 2.079ms | 93.1% | ✅ excellent |
| audit.verify.1000 | <250ms | 20.976ms | 91.6% | ✅ excellent |
| hierarchy.query.3level | <300ms | 2.010ms | 99.3% | ✅ excellent |
| branch.deepcopy.1k | <200ms | 28.624ms | 85.7% | ✅ excellent |
| subagent.invoke.absorb | <50ms | 0.350ms | 99.3% | ✅ excellent |
| normalize.roundtrip.npm | <5ms | 0.027ms | 99.5% | ✅ excellent |
| normalize.import.autodetect | <10ms | 0.750ms | 92.5% | ✅ excellent |
| selflearning.detect.1k | <150ms | 0.847ms | 99.4% | ✅ excellent |
| migration.apply.all | <200ms | 3.852ms | 98.1% | ✅ excellent |

## Throughput Leaders (Top 10 ops/sec)

| Rank | Benchmark | ops/sec |
|---|---|---|
| 1 | permission.exact | 6,903,169 |
| 2 | permission.prefix | 3,260,558 |
| 3 | cosine.384dim | 1,596,796 |
| 4 | memory.fetch.inline | 140,067 |
| 5 | manifest.validate | 89,307 |
| 6 | blake3.hash.1kb | 54,767 |
| 7 | normalize.roundtrip.npm | 40,327 |
| 8 | blob.put.new | 29,825 |
| 9 | blob.put.dedup | 9,413 |
| 10 | audit.append | 9,010 |

## Memory Footprint (Top 10 by heap Δ)

| Rank | Benchmark | Heap Δ (MB) | RSS Δ (MB) |
|---|---|---|---|
| 1 | selflearning.detect.1k | 53.37 | 0.02 |
| 2 | audit.verify.1000 | 51.28 | 65.46 |
| 3 | hierarchy.query.3level | 51.03 | -4.20 |
| 4 | normalize.import.autodetect | 41.63 | 0.61 |
| 5 | normalize.roundtrip.npm | 32.58 | 0.00 |
| 6 | search.1k | 32.39 | 31.83 |
| 7 | branch.deepcopy.1k | 31.87 | 109.82 |
| 8 | manifest.validate | 28.52 | 0.79 |
| 9 | search.10k | 28.37 | 0.36 |
| 10 | audit.append | 22.06 | 9.57 |

## Recommendations

✅ All SLO targets met. No performance regressions detected.

⚠️ 3 benchmark(s) with heap Δ > 50MB:
- **audit.verify.1000**: 51.28MB heap, 65.46MB RSS
- **hierarchy.query.3level**: 51.03MB heap, -4.20MB RSS
- **selflearning.detect.1k**: 53.37MB heap, 0.02MB RSS

---
*Generated by Orqenix Demo Performance Test*