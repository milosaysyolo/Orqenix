// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { MetricsRegistry, METRIC_NAMES, type MetricSink } from "../src";

describe("MetricsRegistry", () => {
  it("counter accumulates", () => {
    const r = new MetricsRegistry();
    const c = r.counter("hits");
    c.inc();
    c.inc(2);
    c.inc(7);
    expect(r.snapshot().counters[0].value).toBe(10);
  });

  it("gauge is set, not accumulated", () => {
    const r = new MetricsRegistry();
    const g = r.gauge("queue_depth");
    g.set(5);
    g.set(3);
    expect(r.snapshot().gauges[0].value).toBe(3);
  });

  it("histogram computes percentiles", () => {
    const r = new MetricsRegistry();
    const h = r.histogram("latency");
    for (let i = 1; i <= 100; i++) h.observe(i);
    const snap = r.snapshot().histograms[0];
    expect(snap.count).toBe(100);
    expect(snap.min).toBe(1);
    expect(snap.max).toBe(100);
    expect(snap.p50).toBeCloseTo(50.5, 1);
    expect(snap.p95).toBeCloseTo(95.05, 1);
    expect(snap.p99).toBeCloseTo(99.01, 1);
  });

  it("histogram drops oldest when over cap", () => {
    const r = new MetricsRegistry();
    const h = r.histogram("big");
    for (let i = 0; i < 15_000; i++) h.observe(i);
    const snap = r.snapshot().histograms[0];
    expect(snap.count).toBe(10_000);
    expect(snap.min).toBeGreaterThan(0);
  });

  it("labels separate metric keys", () => {
    const r = new MetricsRegistry();
    r.counter("req", { method: "GET" }).inc(3);
    r.counter("req", { method: "POST" }).inc(5);
    const snap = r.snapshot();
    expect(snap.counters).toHaveLength(2);
    expect(snap.counters.find((c) => c.labels.method === "GET")?.value).toBe(3);
    expect(snap.counters.find((c) => c.labels.method === "POST")?.value).toBe(5);
  });

  it("sink receives every observation", () => {
    const r = new MetricsRegistry();
    const observed: Array<{ kind: string; name: string; value: number }> = [];
    const sink: MetricSink = {
      onCounter(name, value) {
        observed.push({ kind: "c", name, value });
      },
      onGauge(name, value) {
        observed.push({ kind: "g", name, value });
      },
      onHistogram(name, value) {
        observed.push({ kind: "h", name, value });
      },
    };
    r.setSink(sink);
    r.counter("a").inc(2);
    r.gauge("b").set(9);
    r.histogram("c").observe(3);
    expect(observed).toHaveLength(3);
  });

  it("reset clears all metrics", () => {
    const r = new MetricsRegistry();
    r.counter("a").inc();
    r.gauge("b").set(1);
    r.histogram("c").observe(1);
    r.reset();
    const s = r.snapshot();
    expect(s.counters).toHaveLength(0);
    expect(s.gauges).toHaveLength(0);
    expect(s.histograms).toHaveLength(0);
  });

  it("canonical metric names exported", () => {
    expect(METRIC_NAMES.COMPRESS_RATIO).toBe("orqenix.compress.ratio");
    expect(METRIC_NAMES.DISTILL_MEMORIES_CREATED).toBe("orqenix.distill.memories_created");
  });
});
