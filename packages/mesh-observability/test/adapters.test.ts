import { describe, it, expect } from 'vitest';
import {
  onPeerConnect, onPeerDisconnect, onRpcDenied, onRpcIn, onRpcOut, onFailover,
  onCircuitOpen, onCircuitHalfOpen, onCircuitClose, onTransportStart, onTransportStop,
  onDiscoveryFound, onDiscoveryLost,
} from '../src/adapters.js';
import { MeshLogger, bufferSink } from '../src/logger.js';
import { METRIC_NAMES, MeshMetrics } from '../src/metrics.js';
import type { MeshRequest, MeshResponse, ScopeId } from '@orqenix/mesh-transport-core';

function mkHooks() {
  const buf = bufferSink();
  const logger = new MeshLogger({ sink: buf.sink, level: 'debug' });
  const metrics = new MeshMetrics();
  return { logger, metrics, buf };
}

const REQ: MeshRequest = {
  id: '01HV0R6X3M8YQ9G7F2D5W1ADAPT',
  fromScope: 'scp_b3_A' as unknown as ScopeId,
  toScope: 'scp_b3_B' as unknown as ScopeId,
  capability: 'cap_test' as unknown as any,
  method: 'memory.query',
  payload: new Uint8Array([1, 2, 3]),
  deadlineMs: Date.now() + 1000,
  trace: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
};

describe('observability adapters', () => {
  it('rpc.in emits an info log without payload bytes', () => {
    const { logger, metrics, buf } = mkHooks();
    onRpcIn({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'http' }, REQ);
    expect(buf.events.length).toBe(1);
    expect(buf.events[0].event).toBe('rpc.in');
    expect(buf.lines[0]).not.toContain('"payload"');
  });

  it('rpc.out increments rpc_total and observes duration', () => {
    const { logger, metrics, buf } = mkHooks();
    const resp: MeshResponse = { id: REQ.id, status: 'ok' };
    onRpcOut({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'http' }, REQ, resp, 12);
    const snap = metrics.snapshot();
    const total = snap.counters.find((c) => c.name === METRIC_NAMES.RPC_TOTAL);
    const dur = snap.histograms.find((h) => h.name === METRIC_NAMES.RPC_DURATION_MS);
    expect(total?.value).toBe(1);
    expect(dur?.summary.count).toBe(1);
    expect(buf.events.at(-1)?.durationMs).toBe(12);
  });

  it('rpc.denied carries the errorCode and increments counter with status=denied', () => {
    const { logger, metrics } = mkHooks();
    onRpcDenied({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'http' }, { id: REQ.id, method: REQ.method }, 'E_CAP_EXPIRED');
    const snap = metrics.snapshot();
    const denied = snap.counters.find((c) => c.name === METRIC_NAMES.RPC_TOTAL && c.labels.includes('status=denied'));
    expect(denied?.value).toBe(1);
  });

  it('peer connect/disconnect updates the peers gauge', () => {
    const { logger, metrics } = mkHooks();
    onPeerConnect({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'libp2p', peerCount: 3 });
    onPeerDisconnect({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'libp2p', peerCount: 2 });
    const snap = metrics.snapshot();
    expect(snap.gauges.find((g) => g.name === METRIC_NAMES.PEERS)?.value).toBe(2);
  });

  it('failover increments failover_total with from/to labels', () => {
    const { logger, metrics } = mkHooks();
    onFailover({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, from: 'libp2p', to: 'http' });
    const snap = metrics.snapshot();
    const ev = snap.counters.find((c) => c.name === METRIC_NAMES.FAILOVER_TOTAL);
    expect(ev?.value).toBe(1);
    expect(ev?.labels).toContain('from=libp2p');
  });

  it('circuit open/halfopen/close sets gauge to 2/1/0', () => {
    const { logger, metrics } = mkHooks();
    onCircuitOpen({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'libp2p' });
    expect(metrics.snapshot().gauges.find((g) => g.name === METRIC_NAMES.CIRCUIT_STATE)?.value).toBe(2);
    onCircuitHalfOpen({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'libp2p' });
    expect(metrics.snapshot().gauges.find((g) => g.name === METRIC_NAMES.CIRCUIT_STATE)?.value).toBe(1);
    onCircuitClose({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'libp2p' });
    expect(metrics.snapshot().gauges.find((g) => g.name === METRIC_NAMES.CIRCUIT_STATE)?.value).toBe(0);
  });

  it('transport.start/stop and discovery.found/lost emit info events', () => {
    const { logger, metrics, buf } = mkHooks();
    onTransportStart({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'http' });
    onTransportStop({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'http' });
    onDiscoveryFound({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'libp2p' });
    onDiscoveryLost({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'libp2p' });
    const names = buf.events.map((e) => e.event);
    expect(names).toEqual(['transport.start', 'transport.stop', 'discovery.found', 'discovery.lost']);
  });
});
