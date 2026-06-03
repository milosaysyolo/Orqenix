// SPDX-License-Identifier: Apache-2.0
// @bc CS-015 Token Visibility
// @gate G22.3, G22.4

import { MetricsRegistry, METRIC_NAMES } from "@orqenix/telemetry";

export interface CompressionSummary {
  totalIn: number;
  totalOut: number;
  avgRatio: number;
  p95DurationMs: number;
  perStrategyBreakdown: Array<{
    strategy: string;
    tokensIn: number;
    tokensOut: number;
    calls: number;
  }>;
}

export function summarizeMetrics(registry: MetricsRegistry): CompressionSummary {
  const snap = registry.snapshot();
  const tokensInRows = snap.counters.filter((c) => c.name === METRIC_NAMES.COMPRESS_TOKENS_IN);
  const tokensOutRows = snap.counters.filter((c) => c.name === METRIC_NAMES.COMPRESS_TOKENS_OUT);
  const ratioHist = snap.histograms.find((h) => h.name === METRIC_NAMES.COMPRESS_RATIO);
  const durHist = snap.histograms.find((h) => h.name === METRIC_NAMES.COMPRESS_DURATION_MS);

  const totalIn = tokensInRows.reduce((a, r) => a + r.value, 0);
  const totalOut = tokensOutRows.reduce((a, r) => a + r.value, 0);

  const perStrategy = new Map<
    string,
    { strategy: string; tokensIn: number; tokensOut: number; calls: number }
  >();
  for (const row of tokensInRows) {
    const s = row.labels.strategy ?? "unknown";
    const cur = perStrategy.get(s) ?? { strategy: s, tokensIn: 0, tokensOut: 0, calls: 0 };
    cur.tokensIn += row.value;
    perStrategy.set(s, cur);
  }
  for (const row of tokensOutRows) {
    const s = row.labels.strategy ?? "unknown";
    const cur = perStrategy.get(s) ?? { strategy: s, tokensIn: 0, tokensOut: 0, calls: 0 };
    cur.tokensOut += row.value;
    perStrategy.set(s, cur);
  }
  if (durHist) {
    const total = durHist.count;
    const split = Math.max(1, perStrategy.size);
    for (const v of perStrategy.values()) v.calls = Math.round(total / split);
  }

  return {
    totalIn,
    totalOut,
    avgRatio: ratioHist && ratioHist.count > 0 ? ratioHist.sum / ratioHist.count : 1,
    p95DurationMs: durHist?.p95 ?? 0,
    perStrategyBreakdown: [...perStrategy.values()].sort((a, b) => b.tokensIn - a.tokensIn),
  };
}

export function formatRatioBar(ratio: number, width = 20): string {
  const pct = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return `[${"#".repeat(filled)}${"-".repeat(empty)}] ${Math.round(pct * 100)}%`;
}
