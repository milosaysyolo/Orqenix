import { describe, it, expect } from 'vitest';
import { MeshLogger, bufferSink } from '../src/logger.js';

describe('MeshLogger', () => {
  it('emits a valid event to the sink', () => {
    const { events, sink } = bufferSink();
    const log = new MeshLogger({ sink, level: 'debug' });
    log.emit({
      level: 'info',
      event: 'rpc.in',
      scopeId: 'scp_b3_aa' as any,
      transport: 'http',
      requestId: 'rid-1',
      method: 'memory.query',
    });
    expect(events.length).toBe(1);
    expect(events[0].event).toBe('rpc.in');
    expect(events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('drops events below the configured level', () => {
    const { events, sink } = bufferSink();
    const log = new MeshLogger({ sink, level: 'warn' });
    log.emit({ level: 'info', event: 'rpc.in', scopeId: 'a' as any, transport: 'http' });
    expect(events.length).toBe(0);
  });

  it('drops events that fail schema validation in non-strict mode', () => {
    const { events, sink } = bufferSink();
    const log = new MeshLogger({ sink, level: 'debug' });
    log.emit({ level: 'info', event: 'bogus' as any, scopeId: 'a' as any, transport: 'http' });
    expect(events.length).toBe(0);
  });

  it('throws on schema violation in strict mode', () => {
    const log = new MeshLogger({ strict: true });
    expect(() => log.emit({ level: 'info', event: 'bogus' as any, scopeId: 'a' as any, transport: 'http' })).toThrow();
  });

  it('drops events whose serialization triggers a redaction leak', () => {
    const { events, lines, sink } = bufferSink();
    const log = new MeshLogger({ sink, level: 'debug' });
    log.emit({ level: 'info', event: 'rpc.in', scopeId: 'a' as any, transport: 'http', method: 'A'.repeat(200) });
    const leaked = lines.some((l) => l.includes('A'.repeat(200)));
    expect(leaked).toBe(false);
    expect(events.every((e) => e.errorCode === 'E_LOG_REDACTION' || e.event !== 'rpc.in' || !e.method?.includes('A'.repeat(200)))).toBe(true);
  });
});
