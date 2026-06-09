import { describe, it, expect } from 'vitest';
import { derivePeerFromScope, hkdfSha256, scopeIdToSaltBytes } from '../src/peer-id.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

const FIXED_SEED = new Uint8Array(32).map((_, i) => (i + 1) & 0xff);
const FIXED_SCOPE = 'scp_b3_' + 'ab'.repeat(32);

describe('HKDF peer-id derivation', () => {
  it('is deterministic for identical inputs', async () => {
    const salt = scopeIdToSaltBytes(FIXED_SCOPE as ScopeId);
    const a = await hkdfSha256(FIXED_SEED, salt, new TextEncoder().encode('orqenix/mesh/peer/v1'), 32);
    const b = await hkdfSha256(FIXED_SEED, salt, new TextEncoder().encode('orqenix/mesh/peer/v1'), 32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('derives a stable peer ID across calls', async () => {
    const salt = scopeIdToSaltBytes(FIXED_SCOPE as ScopeId);
    const a = await derivePeerFromScope({ scopeSeed: FIXED_SEED, scopeIdBytes: salt });
    const b = await derivePeerFromScope({ scopeSeed: FIXED_SEED, scopeIdBytes: salt });
    expect(a.peerId.toString()).toBe(b.peerId.toString());
  });

  it('produces a different peer ID when the scope seed differs', async () => {
    const salt = scopeIdToSaltBytes(FIXED_SCOPE as ScopeId);
    const a = await derivePeerFromScope({ scopeSeed: FIXED_SEED, scopeIdBytes: salt });
    const other = new Uint8Array(32).map((_, i) => (i + 100) & 0xff);
    const b = await derivePeerFromScope({ scopeSeed: other, scopeIdBytes: salt });
    expect(a.peerId.toString()).not.toBe(b.peerId.toString());
  });

  it('rejects wrong-length inputs', async () => {
    await expect(
      derivePeerFromScope({ scopeSeed: new Uint8Array(16), scopeIdBytes: new Uint8Array(32) }),
    ).rejects.toThrow();
    await expect(
      derivePeerFromScope({ scopeSeed: new Uint8Array(32), scopeIdBytes: new Uint8Array(8) }),
    ).rejects.toThrow();
  });
});
