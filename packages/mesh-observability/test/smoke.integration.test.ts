import { describe, it, expect } from 'vitest';
import { bufferSink, MeshLogger } from '../src/logger.js';
import { MeshMetrics } from '../src/metrics.js';
import { onRpcIn, onRpcOut, onFailover } from '../src/adapters.js';
import { buildOutgoingTraceContext, traceIdOf } from '../src/trace.js';
import type { MeshRequest, MeshResponse, ScopeId } from '@orqenix/mesh-transport-core';

describe('Part 8 smoke: 2-hop trace propagation + redaction holds', () => {
  it('child hop inherits trace-id; logs contain no token bytes', () => {
    const { sink, lines, events } = bufferSink();
    const logger = new MeshLogger({ sink, level: 'debug' });
    const metrics = new MeshMetrics();

    const traceA = buildOutgoingTraceContext();
    const reqA: MeshRequest = {
      id: '01HV0R6X3M8YQ9G7F2D5W1HOP1',
      fromScope: 'scp_b3_C' as unknown as ScopeId,
      toScope: 'scp_b3_A' as unknown as ScopeId,
      capability: 'eyJjYXAiOiAibm90LWEtcmVhbC10b2tlbiJ9' as unknown as any,
      method: 'memory.query',
      payload: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      deadlineMs: Date.now() + 2000,
      trace: traceA,
    };
    onRpcIn({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'http' }, reqA);
    const respA: MeshResponse = { id: reqA.id, status: 'ok' };
    onRpcOut({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, transport: 'http' }, reqA, respA, 8);

    const traceB = buildOutgoingTraceContext(traceA.traceparent);
    const reqB: MeshRequest = { ...reqA, id: '01HV0R6X3M8YQ9G7F2D5W1HOP2', toScope: 'scp_b3_B' as unknown as ScopeId, trace: traceB };
    onRpcIn({ logger, metrics }, { scopeId: 'scp_b3_B' as unknown as ScopeId, transport: 'libp2p' }, reqB);
    onRpcOut({ logger, metrics }, { scopeId: 'scp_b3_B' as unknown as ScopeId, transport: 'libp2p' }, reqB, { id: reqB.id, status: 'ok' }, 11);

    expect(traceIdOf(traceA.traceparent)).toBe(traceIdOf(traceB.traceparent));

    onFailover({ logger, metrics }, { scopeId: 'scp_b3_A' as unknown as ScopeId, from: 'libp2p', to: 'http' });

    const joined = lines.join('\n');
    expect(joined).not.toContain('eyJjYXAiOiAibm90LWEtcmVhbC10b2tlbiJ9');
    expect(joined).not.toContain('"payload"');
    expect(events.filter((e) => e.event === 'rpc.in').length).toBe(2);
    expect(events.filter((e) => e.event === 'rpc.out').length).toBe(2);
    expect(events.filter((e) => e.event === 'failover').length).toBe(1);
  });
});
