import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from '../src/circuit-breaker.js';
import { MeshLogger, MeshMetrics, bufferSink } from '@orqenix/mesh-observability';

function mkHooks() {
  const buf = bufferSink();
  return { hooks: { logger: new MeshLogger({ sink: buf.sink, level: 'debug' }), metrics: new MeshMetrics() }, buf };
}

describe('CircuitBreaker', () => {
  it('opens after failureThreshold consecutive failures', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    expect(cb.stateOf('http')).toBe('Closed');
    cb.recordFailure('http');
    cb.recordFailure('http');
    expect(cb.stateOf('http')).toBe('Closed');
    cb.recordFailure('http');
    expect(cb.stateOf('http')).toBe('Open');
  });

  it('blocks attempts when open before cooldown elapses', () => {
    let nowMs = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 1_000, now: () => nowMs });
    cb.recordFailure('http');
    expect(cb.stateOf('http')).toBe('Open');
    expect(cb.canAttempt('http')).toBe(false);
  });

  it('transitions Open -> HalfOpen after cooldown and allows one probe', () => {
    let nowMs = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 100, now: () => nowMs });
    cb.recordFailure('http');
    nowMs = 200;
    expect(cb.canAttempt('http')).toBe(true);
    expect(cb.stateOf('http')).toBe('HalfOpen');
    expect(cb.canAttempt('http')).toBe(false);
  });

  it('HalfOpen success closes the breaker; failure reopens it', () => {
    let nowMs = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 50, now: () => nowMs });
    cb.recordFailure('http');
    nowMs = 100;
    expect(cb.canAttempt('http')).toBe(true);
    cb.recordSuccess('http');
    expect(cb.stateOf('http')).toBe('Closed');

    cb.recordFailure('http');
    nowMs = 200;
    expect(cb.canAttempt('http')).toBe(true);
    cb.recordFailure('http');
    expect(cb.stateOf('http')).toBe('Open');
  });

  it('emits onCircuitOpen / HalfOpen / Close via observability hooks', () => {
    let nowMs = 0;
    const { hooks, buf } = mkHooks();
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 50, now: () => nowMs, hooks });
    cb.recordFailure('http');
    nowMs = 100;
    cb.canAttempt('http');
    cb.recordSuccess('http');
    const events = buf.events.map((e) => e.event);
    expect(events).toEqual(['circuit.open', 'circuit.halfopen', 'circuit.close']);
  });
});
