import { describe, it, expect } from 'vitest';
import { METRIC_NAMES, MeshMetrics } from '../src/metrics.js';

describe('MeshMetrics', () => {
  it('pre-registers the six locked metric names', () => {
    const m = new MeshMetrics();
    const names = m.registeredNames();
    expect(names).toEqual(
      [
        METRIC_NAMES.RPC_TOTAL,
        METRIC_NAMES.RPC_DURATION_MS,
        METRIC_NAMES.PEERS,
        METRIC_NAMES.CAPABILITY_VERIFY_MS,
        METRIC_NAMES.FAILOVER_TOTAL,
        METRIC_NAMES.CIRCUIT_STATE,
      ].sort(),
    );
  });

  it('counters add up with labels', () => {
    const m = new MeshMetrics();
    m.incCounter(METRIC_NAMES.RPC_TOTAL, 1, { transport: 'http', status: 'ok' });
    m.incCounter(METRIC_NAMES.RPC_TOTAL, 2, { transport: 'http', status: 'ok' });
    m.incCounter(METRIC_NAMES.RPC_TOTAL, 5, { transport: 'libp2p', status: 'ok' });
    const snap = m.snapshot();
    const httpOk = snap.counters.find((c) => c.name === METRIC_NAMES.RPC_TOTAL && c.labels.includes('transport=http'));
    const libOk = snap.counters.find((c) => c.name === METRIC_NAMES.RPC_TOTAL && c.labels.includes('transport=libp2p'));
    expect(httpOk?.value).toBe(3);
    expect(libOk?.value).toBe(5);
  });

  it('histogram computes p50 / p95 / p99', () => {
    const m = new MeshMetrics();
    for (let i = 1; i <= 100; i++) m.observeHistogram(METRIC_NAMES.RPC_DURATION_MS, i);
    const snap = m.snapshot();
    const h = snap.histograms.find((x) => x.name === METRIC_NAMES.RPC_DURATION_MS);
    expect(h).toBeDefined();
    expect(h!.summary.count).toBe(100);
    expect(h!.summary.p50).toBe(51);
    expect(h!.summary.p95).toBe(96);
    expect(h!.summary.p99).toBe(100);
  });

  it('histogram bounds memory at the configured capacity', () => {
    const m = new MeshMetrics({ histogramCapacity: 32 });
    for (let i = 0; i < 1_000; i++) m.observeHistogram(METRIC_NAMES.RPC_DURATION_MS, i);
    const snap = m.snapshot();
    const h = snap.histograms.find((x) => x.name === METRIC_NAMES.RPC_DURATION_MS);
    expect(h!.summary.count).toBe(32);
  });

  it('gauge holds the last value per label set', () => {
    const m = new MeshMetrics();
    m.setGauge(METRIC_NAMES.PEERS, 3, { transport: 'libp2p' });
    m.setGauge(METRIC_NAMES.PEERS, 5, { transport: 'libp2p' });
    const snap = m.snapshot();
    const g = snap.gauges.find((x) => x.name === METRIC_NAMES.PEERS);
    expect(g?.value).toBe(5);
  });
});
