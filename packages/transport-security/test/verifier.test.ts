import { describe, it, expect } from 'vitest';
import { CapabilityVerifier } from '../src/verifier.js';
import { Ed25519Signer } from '../src/signer.js';
import { LRUKeyStore } from '../src/key-store.js';
import {
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
  ed25519Sign,
  b64urlEncode,
} from '../src/ed25519.js';
import {
  canonicalSigningBytes,
  encodeCapabilityToken,
  type CapabilityTokenFields,
} from '../src/capability-token.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

async function mkIssued(over: Partial<CapabilityTokenFields> = {}) {
  const kp = await generateEd25519Keypair();
  const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
  const base: Omit<CapabilityTokenFields, 'sig'> = {
    iss: 'scp_b3_B' as ScopeId,
    sub: 'scp_b3_A' as ScopeId,
    caps: ['memory.query', 'kb.recall.*'],
    exp: Date.now() + 60_000,
    jti: '01HV0R6X3M8YQ9G7F2D5W1KZJP',
    ...over,
  };
  const signed = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
  const token: CapabilityTokenFields = { ...base, sig: b64urlEncode(signed) };
  return { token, pubRaw, kp };
}

describe('CapabilityVerifier', () => {
  it('accepts a well-formed, in-window, correctly bound token', async () => {
    const { token, pubRaw } = await mkIssued();
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect(r.ok).toBe(true);
  });

  it('denies missing token', async () => {
    const v = new CapabilityVerifier({ keyStore: new LRUKeyStore() });
    const r = await v.verify({
      capability: '',
      fromScope: 'a' as ScopeId,
      toScope: 'b' as ScopeId,
      method: 'memory.query',
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe('E_CAP_MISSING');
  });

  it('denies expired token', async () => {
    const { token, pubRaw } = await mkIssued({ exp: Date.now() - 1 });
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect((r as { code: string }).code).toBe('E_CAP_EXPIRED');
  });

  it('denies bad signature', async () => {
    const { token, pubRaw } = await mkIssued();
    const broken = { ...token, sig: b64urlEncode(new Uint8Array(64)) };
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(broken),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect((r as { code: string }).code).toBe('E_CAP_SIG_INVALID');
  });

  it('denies subject mismatch', async () => {
    const { token, pubRaw } = await mkIssued();
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: 'scp_b3_other' as ScopeId,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect((r as { code: string }).code).toBe('E_CAP_SUBJECT_MISMATCH');
  });

  it('denies issuer mismatch', async () => {
    const { token, pubRaw } = await mkIssued();
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: 'scp_b3_other' as ScopeId,
      method: 'memory.query',
    });
    expect((r as { code: string }).code).toBe('E_CAP_ISSUER_MISMATCH');
  });

  it('denies method not allowed', async () => {
    const { token, pubRaw } = await mkIssued({ caps: ['memory.query'] });
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'kb.recall.advanced',
    });
    expect((r as { code: string }).code).toBe('E_CAP_METHOD_NOT_ALLOWED');
  });

  it('signer end-to-end produces a verifiable scope-sig', async () => {
    const kp = await generateEd25519Keypair();
    const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
    const ks = new LRUKeyStore();
    const fromScope = 'scp_b3_A' as ScopeId;
    ks.put(fromScope, pubRaw);

    const signer = new Ed25519Signer({ fromScope, privateKey: kp.privateKey });
    const sigB64u = await signer.signScopeProof('rid-123', 'scp_b3_B' as ScopeId);

    const { Ed25519IdentityVerifier } = await import('../src/adapters.js');
    const adapter = new Ed25519IdentityVerifier({ keyStore: ks });
    const ok = await adapter.verifyScopeSig(fromScope, 'rid-123', 'scp_b3_B' as ScopeId, sigB64u);
    expect(ok).toBe(true);
  });
});

describe('CapabilityVerifier additional coverage', () => {
  it('denies token expired between parse and verify (clock skew)', async () => {
    const { token, pubRaw } = await mkIssued({ exp: Date.now() + 1 });
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const wire = encodeCapabilityToken(token);
    await new Promise((r) => setTimeout(r, 5));
    const r = await v.verify({
      capability: wire,
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect((r as { code: string }).code).toBe('E_CAP_EXPIRED');
  });

  it('denies token not yet valid (nbf in future)', async () => {
    const { token, pubRaw } = await mkIssued({ nbf: Date.now() + 60_000 });
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe('E_CAP_EXPIRED');
  });

  it('delegation hook overrides ok to denied', async () => {
    const { token, pubRaw } = await mkIssued();
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({
      keyStore: ks,
      delegation: async () => ({ ok: false, code: 'E_DELEGATION_REVOKED', message: 'revoked' }),
    });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe('E_DELEGATION_REVOKED');
  });

  it('delegation hook accepts pass-through', async () => {
    const { token, pubRaw } = await mkIssued();
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    let hookCalled = false;
    const v = new CapabilityVerifier({
      keyStore: ks,
      delegation: async () => { hookCalled = true; return { ok: true, token: {} }; },
    });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: token.sub,
      toScope: token.iss,
      method: 'memory.query',
    });
    expect(r.ok).toBe(true);
    expect(hookCalled).toBe(true);
  });
});
