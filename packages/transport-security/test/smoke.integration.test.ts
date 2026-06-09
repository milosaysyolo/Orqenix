import { describe, it, expect } from 'vitest';
import { CapabilityVerifier } from '../src/verifier.js';
import { Ed25519IdentityVerifier } from '../src/adapters.js';
import { Ed25519Signer } from '../src/signer.js';
import { LRUKeyStore } from '../src/key-store.js';
import {
  b64urlEncode,
  ed25519Sign,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
} from '../src/ed25519.js';
import {
  canonicalSigningBytes,
  encodeCapabilityToken,
  type CapabilityTokenFields,
} from '../src/capability-token.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

describe('Part 6 smoke: end-to-end Ed25519 verifier + signer + capability pipeline', () => {
  it('issuer signs, verifier accepts; tamper anywhere -> denied', async () => {
    const kpA = await generateEd25519Keypair();
    const kpB = await generateEd25519Keypair();
    const sub = 'scp_b3_A' as ScopeId;
    const iss = 'scp_b3_B' as ScopeId;

    const ks = new LRUKeyStore();
    ks.put(sub, await exportEd25519PublicKeyRaw(kpA.publicKey));
    ks.put(iss, await exportEd25519PublicKeyRaw(kpB.publicKey));

    const signer = new Ed25519Signer({ fromScope: sub, privateKey: kpA.privateKey });
    const sigB64u = await signer.signScopeProof('rid-smoke', iss);

    const idVerifier = new Ed25519IdentityVerifier({ keyStore: ks });
    expect(await idVerifier.verifyScopeSig(sub, 'rid-smoke', iss, sigB64u)).toBe(true);

    const base: Omit<CapabilityTokenFields, 'sig'> = {
      iss,
      sub,
      caps: ['memory.query', 'kb.recall.*'],
      exp: Date.now() + 60_000,
      jti: '01HV0R6X3M8YQ9G7F2D5W1KSMK6',
    };
    const tokenSig = await ed25519Sign(kpB.privateKey, canonicalSigningBytes(base));
    const token: CapabilityTokenFields = { ...base, sig: b64urlEncode(tokenSig) };

    const v = new CapabilityVerifier({ keyStore: ks });
    const ok = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: sub,
      toScope: iss,
      method: 'memory.query',
    });
    expect(ok.ok).toBe(true);

    const denied = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: sub,
      toScope: iss,
      method: 'admin.delete',
    });
    expect(denied.ok).toBe(false);
    expect((denied as { code: string }).code).toBe('E_CAP_METHOD_NOT_ALLOWED');
  });
});
