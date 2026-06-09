import { describe, it, expect } from 'vitest';
import { Ed25519Signer, makeSignFn } from '../src/signer.js';
import {
  b64urlDecode,
  ed25519Verify,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
  importEd25519PublicKey,
} from '../src/ed25519.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

describe('Ed25519Signer', () => {
  it('signScopeProof yields a signature that verifies against the public key', async () => {
    const kp = await generateEd25519Keypair();
    const fromScope = 'scp_b3_A' as ScopeId;
    const signer = new Ed25519Signer({ fromScope, privateKey: kp.privateKey });
    const sigB64u = await signer.signScopeProof('rid-1', 'scp_b3_B' as ScopeId);

    const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
    const pub = await importEd25519PublicKey(pubRaw);
    const msg = new TextEncoder().encode('rid-1.scp_b3_B');
    expect(await ed25519Verify(pub, b64urlDecode(sigB64u), msg)).toBe(true);
  });

  it('makeSignFn produces a SignFn-shaped function', async () => {
    const kp = await generateEd25519Keypair();
    const signer = new Ed25519Signer({ fromScope: 'scp_b3_A' as ScopeId, privateKey: kp.privateKey });
    const sign = makeSignFn(signer);
    const sig = await sign('rid-2', 'scp_b3_B' as ScopeId);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('different requestId or toScope yields different signatures', async () => {
    const kp = await generateEd25519Keypair();
    const signer = new Ed25519Signer({ fromScope: 'scp_b3_A' as ScopeId, privateKey: kp.privateKey });
    const a = await signer.signScopeProof('rid-A', 'scp_b3_B' as ScopeId);
    const b = await signer.signScopeProof('rid-A', 'scp_b3_C' as ScopeId);
    const c = await signer.signScopeProof('rid-B', 'scp_b3_B' as ScopeId);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
