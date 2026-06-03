// SPDX-License-Identifier: Apache-2.0
// @bc CS-013 Registry
// @gate G14.3, G22.1

import {
  type CounterSnapshot,
  type GaugeSnapshot,
  type HistogramSnapshot,
  type MetricLabels,
  type MetricSink,
  type MetricsSnapshot,
} from "./contracts.js";

const HIST_MAX = 10_000;

function labelKey(labels: MetricLabels): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join("|");
}

function metricKey(name: string, labels: MetricLabels): string {
  return `${name}#${labelKey(labels)}`;
}

interface CounterInternal {
  value: number;
  labels: MetricLabels;
  name: string;
}
interface GaugeInternal {
  value: number;
  labels: MetricLabels;
  name: string;
}
interface HistogramInternal {
  samples: number[];
  labels: MetricLabels;
  name: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower]!;
  const frac = rank - lower;
  return sorted[lower]! * (1 - frac) + sorted[upper]! * frac;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, CounterInternal>();
  private readonly gauges = new Map<string, GaugeInternal>();
  private readonly histograms = new Map<string, HistogramInternal>();
  private sink: MetricSink | null = null;

  setSink(sink: MetricSink | null): void {
    this.sink = sink;
  }

  counter(name: string, labels: MetricLabels = {}): { inc: (v?: number) => void } {
    const key = metricKey(name, labels);
    return {
      inc: (v = 1) => {
        const cur = this.counters.get(key) ?? { value: 0, labels, name };
        cur.value += v;
        this.counters.set(key, cur);
        this.sink?.onCounter?.(name, v, labels);
      },
    };
  }

  gauge(name: string, labels: MetricLabels = {}): { set: (v: number) => void } {
    const key = metricKey(name, labels);
    return {
      set: (v: number) => {
        this.gauges.set(key, { value: v, labels, name });
        this.sink?.onGauge?.(name, v, labels);
      },
    };
  }

  histogram(name: string, labels: MetricLabels = {}): { observe: (v: number) => void } {
    const key = metricKey(name, labels);
    return {
      observe: (v: number) => {
        const cur = this.histograms.get(key) ?? { samples: [], labels, name };
        if (cur.samples.length >= HIST_MAX) cur.samples.shift();
        cur.samples.push(v);
        this.histograms.set(key, cur);
        this.sink?.onHistogram?.(name, v, labels);
      },
    };
  }

  snapshot(): MetricsSnapshot {
    const counters: CounterSnapshot[] = [];
    for (const c of this.counters.values()) {
      counters.push({ name: c.name, value: c.value, labels: c.labels });
    }
    const gauges: GaugeSnapshot[] = [];
    for (const g of this.gauges.values()) {
      gauges.push({ name: g.name, value: g.value, labels: g.labels });
    }
    const histograms: HistogramSnapshot[] = [];
    for (const h of this.histograms.values()) {
      const sorted = [...h.samples].sort((a, b) => a - b);
      const sum = sorted.reduce((a, x) => a + x, 0);
      histograms.push({
        name: h.name,
        labels: h.labels,
        count: sorted.length,
        sum,
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
      });
    }
    counters.sort((a, b) => a.name.localeCompare(b.name));
    gauges.sort((a, b) => a.name.localeCompare(b.name));
    histograms.sort((a, b) => a.name.localeCompare(b.name));
    return { counters, gauges, histograms };
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

export const METRIC_NAMES = {
  COMPRESS_TOKENS_IN: "orqenix.compress.tokens_in",
  COMPRESS_TOKENS_OUT: "orqenix.compress.tokens_out",
  COMPRESS_RATIO: "orqenix.compress.ratio",
  COMPRESS_DURATION_MS: "orqenix.compress.duration_ms",
  COMPRESS_TIER0_PRESERVED: "orqenix.compress.tier0_preserved",
  DISTILL_ENTRIES_SCANNED: "orqenix.distill.entries_scanned",
  DISTILL_MEMORIES_CREATED: "orqenix.distill.memories_created",
  RECALL_DURATION_MS: "orqenix.recall.duration_ms",
} as const;
