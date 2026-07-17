// SPDX-License-Identifier: Apache-2.0
import { MeshLogger } from './logger.js';
import { METRIC_NAMES, MeshMetrics } from './metrics.js';
import { summarizePayload } from './redaction.js';
import { traceIdOf } from './trace.js';
import type { MeshRequest, MeshResponse, ScopeId } from '@orqenix/mesh-transport-core';

export interface ObservabilityHooks {
  logger: MeshLogger;
  metrics: MeshMetrics;
}

export interface CommonCtx {
  scopeId: ScopeId;
  transport: string;
  peerId?: string;
}

export function onTransportStart(h: ObservabilityHooks, ctx: CommonCtx): void {
  h.logger.emit({ level: 'info', event: 'transport.start', ...ctx });
}
export function onTransportStop(h: ObservabilityHooks, ctx: CommonCtx): void {
  h.logger.emit({ level: 'info', event: 'transport.stop', ...ctx });
}

export function onPeerConnect(h: ObservabilityHooks, ctx: CommonCtx & { peerCount: number }): void {
  h.logger.emit({ level: 'info', event: 'peer.connect', scopeId: ctx.scopeId, transport: ctx.transport, peerId: ctx.peerId });
  h.metrics.setGauge(METRIC_NAMES.PEERS, ctx.peerCount, { transport: ctx.transport });
}
export function onPeerDisconnect(h: ObservabilityHooks, ctx: CommonCtx & { peerCount: number }): void {
  h.logger.emit({ level: 'info', event: 'peer.disconnect', scopeId: ctx.scopeId, transport: ctx.transport, peerId: ctx.peerId });
  h.metrics.setGauge(METRIC_NAMES.PEERS, ctx.peerCount, { transport: ctx.transport });
}

export function onRpcIn(h: ObservabilityHooks, ctx: CommonCtx, req: MeshRequest): void {
  h.logger.emit({
    level: 'info',
    event: 'rpc.in',
    scopeId: ctx.scopeId,
    transport: ctx.transport,
    peerId: ctx.peerId,
    requestId: req.id,
    method: req.method,
  });
}

export function onRpcOut(
  h: ObservabilityHooks,
  ctx: CommonCtx,
  req: MeshRequest,
  resp: MeshResponse,
  durationMs: number,
): void {
  h.logger.emit({
    level: 'info',
    event: 'rpc.out',
    scopeId: ctx.scopeId,
    transport: ctx.transport,
    peerId: ctx.peerId,
    requestId: req.id,
    method: req.method,
    durationMs,
    status: resp.status,
    errorCode: resp.error?.code,
  });
  h.metrics.incCounter(METRIC_NAMES.RPC_TOTAL, 1, { transport: ctx.transport, status: resp.status });
  h.metrics.observeHistogram(METRIC_NAMES.RPC_DURATION_MS, durationMs, { transport: ctx.transport });
  void summarizePayload(resp.payload);
}

export function onRpcDenied(
  h: ObservabilityHooks,
  ctx: CommonCtx,
  req: Pick<MeshRequest, 'id' | 'method'>,
  errorCode: string,
): void {
  h.logger.emit({
    level: 'warn',
    event: 'rpc.denied',
    scopeId: ctx.scopeId,
    transport: ctx.transport,
    peerId: ctx.peerId,
    requestId: req.id,
    method: req.method,
    status: 'denied',
    errorCode,
  });
  h.metrics.incCounter(METRIC_NAMES.RPC_TOTAL, 1, { transport: ctx.transport, status: 'denied' });
}

export function onDiscoveryFound(h: ObservabilityHooks, ctx: CommonCtx): void {
  h.logger.emit({ level: 'info', event: 'discovery.found', scopeId: ctx.scopeId, transport: ctx.transport, peerId: ctx.peerId });
}
export function onDiscoveryLost(h: ObservabilityHooks, ctx: CommonCtx): void {
  h.logger.emit({ level: 'info', event: 'discovery.lost', scopeId: ctx.scopeId, transport: ctx.transport, peerId: ctx.peerId });
}

export function onFailover(
  h: ObservabilityHooks,
  ctx: { scopeId: ScopeId; from: string; to: string },
): void {
  h.logger.emit({ level: 'warn', event: 'failover', scopeId: ctx.scopeId, transport: ctx.from });
  h.metrics.incCounter(METRIC_NAMES.FAILOVER_TOTAL, 1, { from: ctx.from, to: ctx.to });
}

export function onCircuitOpen(h: ObservabilityHooks, ctx: { scopeId: ScopeId; transport: string }): void {
  h.logger.emit({ level: 'warn', event: 'circuit.open', scopeId: ctx.scopeId, transport: ctx.transport });
  h.metrics.setGauge(METRIC_NAMES.CIRCUIT_STATE, 2, { transport: ctx.transport });
}
export function onCircuitHalfOpen(h: ObservabilityHooks, ctx: { scopeId: ScopeId; transport: string }): void {
  h.logger.emit({ level: 'info', event: 'circuit.halfopen', scopeId: ctx.scopeId, transport: ctx.transport });
  h.metrics.setGauge(METRIC_NAMES.CIRCUIT_STATE, 1, { transport: ctx.transport });
}
export function onCircuitClose(h: ObservabilityHooks, ctx: { scopeId: ScopeId; transport: string }): void {
  h.logger.emit({ level: 'info', event: 'circuit.close', scopeId: ctx.scopeId, transport: ctx.transport });
  h.metrics.setGauge(METRIC_NAMES.CIRCUIT_STATE, 0, { transport: ctx.transport });
}

export function rpcTraceId(req: MeshRequest): string | undefined {
  return traceIdOf(req.trace.traceparent);
}
