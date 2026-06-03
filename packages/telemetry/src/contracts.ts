// SPDX-License-Identifier: Apache-2.0
// @bc CS-013 Telemetry Contracts
// @gate G14, G22

import { OrqenixError } from "@orqenix/core";

export interface MetricLabels {
  readonly [key: string]: string;
}

export interface CounterSnapshot {
  readonly name: string;
  readonly value: number;
  readonly labels: MetricLabels;
}
export interface GaugeSnapshot {
  readonly name: string;
  readonly value: number;
  readonly labels: MetricLabels;
}
export interface HistogramSnapshot {
  readonly name: string;
  readonly labels: MetricLabels;
  readonly count: number;
  readonly sum: number;
  readonly min: number;
  readonly max: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
}

export interface MetricsSnapshot {
  counters: CounterSnapshot[];
  gauges: GaugeSnapshot[];
  histograms: HistogramSnapshot[];
}

export interface MetricSink {
  onCounter?(name: string, value: number, labels: MetricLabels): void;
  onGauge?(name: string, value: number, labels: MetricLabels): void;
  onHistogram?(name: string, value: number, labels: MetricLabels): void;
}

export class TelemetryError extends OrqenixError {
  constructor(reason: string) {
    super(`telemetry error: ${reason}`, "TELEMETRY");
  }
}
