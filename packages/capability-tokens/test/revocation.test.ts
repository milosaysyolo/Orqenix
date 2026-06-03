import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RevocationStore } from '../src/revocation';
import { TokenRevokedError } from '../src/contracts';

const ISS = 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const JTI_A = 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' as any;
const JTI_B = 'tok:EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE' as any;

describe('revocation', () => {
  let root: string;
  let store: RevocationStore;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'orqenix-rev-')); store = new RevocationStore(root); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('starts empty', async () => {
    expect(await store.isRevoked(JTI_A)).toBe(false);
    expect(await store.listRevocations()).toEqual([]);
  });

  it('revokes and detects', async () => {
    await store.revoke(JTI_A, 'tested', ISS);
    expect(await store.isRevoked(JTI_A)).toBe(true);
    const rec = await store.getRevocation(JTI_A);
    expect(rec?.reason).toBe('tested');
    expect(rec?.revokedBy).toBe(ISS);
  });

  it('requireNotRevoked throws TokenRevokedError', async () => {
    await store.revoke(JTI_A, 'compromised', ISS);
    await expect(store.requireNotRevoked(JTI_A)).rejects.toThrow(TokenRevokedError);
  });

  it('lists multiple revocations sorted by revokedAt', async () => {
    await store.revoke(JTI_A, 'first', ISS);
    await new Promise((r) => setTimeout(r, 10));
    await store.revoke(JTI_B, 'second', ISS);
    const list = await store.listRevocations();
    expect(list).toHaveLength(2);
    expect(list[0].jti).toBe(JTI_A);
    expect(list[1].jti).toBe(JTI_B);
  });

  it('rejects invalid jti format', async () => {
    await expect(store.revoke('not-a-token' as any, 'x', ISS)).rejects.toThrow(/invalid jti/);
  });
});
