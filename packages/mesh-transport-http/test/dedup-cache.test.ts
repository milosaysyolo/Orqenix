// packages/mesh-transport-http/test/dedup-cache.test.ts
import { describe, it, expect } from 'vitest';
import { DedupCache } from '../src/dedup-cache.js';
import type { MeshResponse } from '@orqenix/mesh-transport-core';

const resp = (id: string): MeshResponse => ({ id, status: 'ok' });

describe('DedupCache', () => {
  it('returns cached entry within TTL', () => {
    const c = new DedupCache({ maxEntries: 10 });
    c.set('a', resp('a'), 1000);
    expect(c.get('a')?.id).toBe('a');
  });

  it('expires after TTL', () => {
    let now = 0;
    const c = new DedupCache({ maxEntries: 10, now: () => now });
    c.set('a', resp('a'), 100);
    now = 200;
    expect(c.get('a')).toBeUndefined();
  });

  it('evicts oldest beyond maxEntries (LRU)', () => {
    const c = new DedupCache({ maxEntries: 3 });
    c.set('a', resp('a'), 10_000);
    c.set('b', resp('b'), 10_000);
    c.set('c', resp('c'), 10_000);
    c.set('d', resp('d'), 10_000);
    expect(c.get('a')).toBeUndefined();
    expect(c.get('d')?.id).toBe('d');
  });

  it('size() returns correct count', () => {
    const c = new DedupCache({ maxEntries: 10 });
    expect(c.size()).toBe(0);
    c.set('a', resp('a'), 1000);
    expect(c.size()).toBe(1);
  });
});
