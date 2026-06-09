export type MetricKind = 'counter' | 'gauge' | 'histogram';

interface Counter {
  kind: 'counter';
  name: string;
  values: Map<string, number>;
}
interface Gauge {
  kind: 'gauge';
  name: string;
  values: Map<string, number>;
}
interface Histogram {
  kind: 'histogram';
  name: string;
  ring: Map<string, number[]>;
  capacity: number;
}

type Metric = Counter | Gauge | Histogram;

function labelKey(labels?: Record<string, string>): string {
  if (!labels) return '';
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(',');
}

export const METRIC_NAMES = {
  RPC_TOTAL: 'orqenix_mesh_rpc_total',
  RPC_DURATION_MS: 'orqenix_mesh_rpc_duration_ms',
  PEERS: 'orqenix_mesh_peers',
  CAPABILITY_VERIFY_MS: 'orqenix_mesh_capability_verify_ms',
  FAILOVER_TOTAL: 'orqenix_mesh_failover_total',
  CIRCUIT_STATE: 'orqenix_mesh_circuit_state',
} as const;

export interface HistogramSummary {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface MetricSnapshot {
  counters: Array<{ name: string; labels: string; value: number }>;
  gauges: Array<{ name: string; labels: string; value: number }>;
  histograms: Array<{ name: string; labels: string; summary: HistogramSummary }>;
}

export interface MeshMetricsOptions {
  histogramCapacity?: number;
}

export class MeshMetrics {
  private readonly metrics = new Map<string, Metric>();
  private readonly histogramCapacity: number;

  constructor(opts: MeshMetricsOptions = {}) {
    this.histogramCapacity = opts.histogramCapacity ?? 1024;
    this.ensureCounter(METRIC_NAMES.RPC_TOTAL);
    this.ensureHistogram(METRIC_NAMES.RPC_DURATION_MS);
    this.ensureGauge(METRIC_NAMES.PEERS);
    this.ensureHistogram(METRIC_NAMES.CAPABILITY_VERIFY_MS);
    this.ensureCounter(METRIC_NAMES.FAILOVER_TOTAL);
    this.ensureGauge(METRIC_NAMES.CIRCUIT_STATE);
  }

  incCounter(name: string, by: number, labels?: Record<string, string>): void {
    const m = this.ensureCounter(name);
    const k = labelKey(labels);
    m.values.set(k, (m.values.get(k) ?? 0) + by);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const m = this.ensureGauge(name);
    m.values.set(labelKey(labels), value);
  }

  observeHistogram(name: string, sample: number, labels?: Record<string, string>): void {
    const m = this.ensureHistogram(name);
    const k = labelKey(labels);
    let buf = m.ring.get(k);
    if (!buf) {
      buf = [];
      m.ring.set(k, buf);
    }
    buf.push(sample);
    if (buf.length > m.capacity) buf.shift();
  }

  snapshot(): MetricSnapshot {
    const counters: MetricSnapshot['counters'] = [];
    const gauges: MetricSnapshot['gauges'] = [];
    const histograms: MetricSnapshot['histograms'] = [];

    for (const m of this.metrics.values()) {
      if (m.kind === 'counter') {
        for (const [labels, value] of m.values) counters.push({ name: m.name, labels, value });
      } else if (m.kind === 'gauge') {
        for (const [labels, value] of m.values) gauges.push({ name: m.name, labels, value });
      } else {
        for (const [labels, buf] of m.ring) histograms.push({ name: m.name, labels, summary: summarize(buf) });
      }
    }
    return { counters, gauges, histograms };
  }

  registeredNames(): string[] {
    return [...this.metrics.keys()].sort();
  }

  private ensureCounter(name: string): Counter {
    let m = this.metrics.get(name);
    if (!m) {
      m = { kind: 'counter', name, values: new Map() };
      this.metrics.set(name, m);
    }
    if (m.kind !== 'counter') throw new Error(`metric ${name} already registered with kind ${m.kind}`);
    return m;
  }
  private ensureGauge(name: string): Gauge {
    let m = this.metrics.get(name);
    if (!m) {
      m = { kind: 'gauge', name, values: new Map() };
      this.metrics.set(name, m);
    }
    if (m.kind !== 'gauge') throw new Error(`metric ${name} already registered with kind ${m.kind}`);
    return m;
  }
  private ensureHistogram(name: string): Histogram {
    let m = this.metrics.get(name);
    if (!m) {
      m = { kind: 'histogram', name, ring: new Map(), capacity: this.histogramCapacity };
      this.metrics.set(name, m);
    }
    if (m.kind !== 'histogram') throw new Error(`metric ${name} already registered with kind ${m.kind}`);
    return m;
  }
}

function summarize(samples: number[]): HistogramSummary {
  if (samples.length === 0) return { count: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = samples.slice().sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted[sorted.length - 1] };
}
