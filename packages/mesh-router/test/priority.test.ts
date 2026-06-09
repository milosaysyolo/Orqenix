import { describe, it, expect } from 'vitest';
import { DEFAULT_PRIORITY, priorityList, sortByPriority } from '../src/priority.js';
import type { MeshTransport, ScopeId } from '@orqenix/mesh-transport-core';

function fakeTransport(kind: string): MeshTransport {
  return {
    kind,
    localScopeId: 'scp_b3_a' as ScopeId,
    async start() {},
    async stop() {},
    async send() { return { id: 'x', status: 'ok' as const }; },
    onRequest() {},
    peers() { return []; },
  } as unknown as MeshTransport;
}

describe('priority', () => {
  it('DEFAULT_PRIORITY is libp2p > http per CR v7.2 7.2', () => {
    expect(DEFAULT_PRIORITY.order).toEqual(['libp2p', 'http']);
  });

  it('rejects duplicates and empty arrays', () => {
    expect(() => priorityList([])).toThrow();
    expect(() => priorityList(['http', 'http'])).toThrow();
  });

  it('sortByPriority places known kinds first in list order', () => {
    const a = fakeTransport('http');
    const b = fakeTransport('libp2p');
    const sorted = sortByPriority([a, b], DEFAULT_PRIORITY);
    expect(sorted.map((t) => t.kind)).toEqual(['libp2p', 'http']);
  });

  it('sortByPriority appends unknown kinds at the end in input order', () => {
    const a = fakeTransport('mystery');
    const b = fakeTransport('libp2p');
    const c = fakeTransport('other');
    const sorted = sortByPriority([a, b, c], DEFAULT_PRIORITY);
    expect(sorted.map((t) => t.kind)).toEqual(['libp2p', 'mystery', 'other']);
  });

  it('custom priority overrides the default', () => {
    const a = fakeTransport('http');
    const b = fakeTransport('libp2p');
    const sorted = sortByPriority([a, b], priorityList(['http', 'libp2p']));
    expect(sorted.map((t) => t.kind)).toEqual(['http', 'libp2p']);
  });
});
