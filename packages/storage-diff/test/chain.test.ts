import { describe, it, expect } from 'vitest';
import { encodeFull, encodeDelta } from '../src/delta';
import { hashBytes } from '../src/hash';
import { reconstructFromChain, shouldSnapshot } from '../src/chain';
import { DiffChainError, type DiffEntry, type ContentHash } from '../src/contracts';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function buildChain(versions: string[]): Promise<DiffEntry[]> {
  const entries: DiffEntry[] = [];
  let prevBytes: Uint8Array | null = null;
  let prevHash: ContentHash | null = null;
  for (let i = 0; i < versions.length; i++) {
    const bytes = enc(versions[i]);
    const contentHash = hashBytes(bytes);
    if (i === 0) {
      const payload = await encodeFull(bytes);
      entries.push({
        entryId: `e${i}`, baseHash: null, contentHash, encoding: 'full',
        payload, sizeBytes: payload.length, createdAt: `2026-01-01T00:00:0${i}Z`,
      });
    } else {
      const payload = await encodeDelta(prevBytes!, bytes);
      entries.push({
        entryId: `e${i}`, baseHash: prevHash, contentHash, encoding: 'zstd-delta',
        payload, sizeBytes: payload.length, createdAt: `2026-01-01T00:00:0${i}Z`,
      });
    }
    prevBytes = bytes;
    prevHash = contentHash;
  }
  return entries;
}

describe('chain', () => {
  it('reconstructs single full entry', async () => {
    const entries = await buildChain(['hello']);
    expect(dec(await reconstructFromChain(entries))).toBe('hello');
  });

  it('reconstructs 5-step delta chain', async () => {
    const versions = ['v1', 'v1 + a', 'v1 + a + b', 'v1 + final', 'final-only'];
    const entries = await buildChain(versions);
    expect(dec(await reconstructFromChain(entries))).toBe('final-only');
  });

  it('throws on empty chain', async () => {
    await expect(reconstructFromChain([])).rejects.toThrow(DiffChainError);
  });

  it('throws when first entry is not full', async () => {
    const entries = await buildChain(['a', 'b']);
    entries[0].encoding = 'zstd-delta';
    await expect(reconstructFromChain(entries)).rejects.toThrow(DiffChainError);
  });

  it('throws on broken chain link', async () => {
    const entries = await buildChain(['a', 'b']);
    entries[1].baseHash = ('0'.repeat(64)) as ContentHash;
    await expect(reconstructFromChain(entries)).rejects.toThrow(DiffChainError);
  });

  it('shouldSnapshot triggers after N entries', () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({
      entryId: `e${i}`,
      baseHash: i === 0 ? null : ('0'.repeat(64) as ContentHash),
      contentHash: '0'.repeat(64) as ContentHash,
      encoding: (i === 0 ? 'full' : 'zstd-delta') as 'full' | 'zstd-delta',
      payload: new Uint8Array(100),
      sizeBytes: 100,
      createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
    }));
    expect(shouldSnapshot(entries, { everyN: 20 })).toBe(true);
  });

  it('shouldSnapshot triggers on cumulative bytes', () => {
    const big = new Uint8Array(70_000);
    const entries = [{
      entryId: 'e0', baseHash: null, contentHash: '0'.repeat(64) as ContentHash,
      encoding: 'full' as const, payload: big, sizeBytes: big.length, createdAt: '2026-01-01T00:00:00Z',
    }, {
      entryId: 'e1', baseHash: '0'.repeat(64) as ContentHash, contentHash: '0'.repeat(64) as ContentHash,
      encoding: 'zstd-delta' as const, payload: big, sizeBytes: big.length, createdAt: '2026-01-01T00:00:01Z',
    }];
    expect(shouldSnapshot(entries, { maxBytes: 64 * 1024 })).toBe(true);
  });
});
