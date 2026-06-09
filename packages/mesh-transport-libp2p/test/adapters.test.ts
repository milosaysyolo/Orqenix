import { describe, it, expect } from 'vitest';
import { buildTransports, defaultListenForAdapters } from '../src/adapters.js';

describe('adapter selection', () => {
  it('builds transports for tcp, websockets, memory without throwing', () => {
    const t1 = buildTransports(['tcp']);
    const t2 = buildTransports(['websockets']);
    const t3 = buildTransports(['memory']);
    const t4 = buildTransports(['tcp', 'websockets']);
    expect(t1?.length).toBe(1);
    expect(t2?.length).toBe(1);
    expect(t3?.length).toBe(1);
    expect(t4?.length).toBe(2);
  });

  it('deduplicates repeated adapters', () => {
    const t = buildTransports(['tcp', 'tcp', 'memory']);
    expect(t?.length).toBe(2);
  });

  it('default listen addresses match selected adapters', () => {
    const tcpListen = defaultListenForAdapters(['tcp']);
    expect(tcpListen[0]).toMatch(/^\/ip4\/.+\/tcp\/0$/);
    const wsListen = defaultListenForAdapters(['websockets']);
    expect(wsListen[0]).toMatch(/^\/ip4\/.+\/tcp\/0\/ws$/);
    const memListen = defaultListenForAdapters(['memory']);
    expect(memListen[0]).toMatch(/^\/memory\//);
  });
});
