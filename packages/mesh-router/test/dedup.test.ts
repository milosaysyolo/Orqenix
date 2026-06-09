import { describe, it, expect } from 'vitest';
import { CrossTransportDedup } from '../src/dedup.js';
import type { MeshResponse } from '@orqenix/mesh-transport-core';

const resp = (id: string): MeshResponse => ({ id, status: 'ok' });

describe('CrossTransportDedup', () => {
  it('returns cached entry within TTL', () => {
    const d = new CrossTransportDedup({ maxEntries: 8 });
    d.set('a', resp('a'), 1_000);
    expect(d.get('a')?.id).toBe('a');
    expect(d.hasUnexpired('a')).toBe(true);
  });

  it('expires after TTL', () => {
    let now = 0;
    const d = new CrossTransportDedup({ maxEntries: 8, now: () => now });
    d.set('a', resp('a'), 100);
    now = 200;
    expect(d.get('a')).toBeUndefined();
    expect(d.hasUnexpired('a')).toBe(false);
  });

  it('evicts oldest beyond maxEntries (LRU)', () => {
    const d = new CrossTransportDedup({ maxEntries: 2 });
    d.set('a', resp('a'), 10_000);
    d.set('b', resp('b'), 10_000);
    d.set('c', resp('c'), 10_000);
    expect(d.get('a')).toBeUndefined();
    expect(d.get('c')?.id).toBe('c');
  });

  it('refreshes LRU position on get', () => {
    const d = new CrossTransportDedup({ maxEntries: 2 });
    d.set('a', resp('a'), 10_000);
    d.set('b', resp('b'), 10_000);
    d.get('a');
    d.set('c', resp('c'), 10_000);
    expect(d.get('a')?.id).toBe('a');
    expect(d.get('b')).toBeUndefined();
  });
});
