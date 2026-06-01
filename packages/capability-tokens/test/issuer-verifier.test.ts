import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPair, deriveScopeId } from '@orqenix/scope-identity';
import { issueToken, delegateToken } from '../src/issuer';
import { TokenVerifier } from '../src/verifier';
import { RevocationStore } from '../src/revocation';
import {
  InsufficientCapabilityError,
  InvalidSignatureError,
  TokenExpiredError,
  TokenNotYetValidError,
  TokenRevokedError,
  UnknownIssuerError,
} from '../src/contracts';

async function newScope() {
  const kp = await generateKeyPair();
  return { ...kp, scopeId: deriveScopeId(kp.publicKey) };
}

describe('issuer + verifier integration', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'orqenix-iv-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  it('issues, encodes, verifies happy path', async () => {
    const iss = await newScope();
    const sub = await newScope();
    const { encoded } = await issueToken({
      issuerScopeId: iss.scopeId,
      issuerPrivateKey: iss.privateKey,
      subjectScopeId: sub.scopeId,
      audienceScopeId: iss.scopeId,
      caps: ['read:kb-docs'],
      ttlSeconds: 3600,
    });
    const verifier = new TokenVerifier({
      getIssuerPublicKey: async (kid) => (kid === iss.scopeId ? iss.publicKey : null),
    });
    const token = await verifier.verify(encoded, 'read:kb-docs');
    expect(token.payload.iss).toBe(iss.scopeId);
  });

  it('rejects unknown issuer', async () => {
    const iss = await newScope();
    const sub = await newScope();
    const { encoded } = await issueToken({
      issuerScopeId: iss.scopeId, issuerPrivateKey: iss.privateKey,
      subjectScopeId: sub.scopeId, audienceScopeId: iss.scopeId,
      caps: ['read:kb-docs'], ttlSeconds: 100,
    });
    const verifier = new TokenVerifier({ getIssuerPublicKey: async () => null });
    await expect(verifier.verify(encoded, 'read:kb-docs')).rejects.toThrow(UnknownIssuerError);
  });

  it('rejects bad signature when issuer pubkey wrong', async () => {
    const iss = await newScope();
    const wrong = await newScope();
    const { encoded } = await issueToken({
      issuerScopeId: iss.scopeId, issuerPrivateKey: iss.privateKey,
      subjectScopeId: iss.scopeId, audienceScopeId: iss.scopeId,
      caps: ['read:*'], ttlSeconds: 100,
    });
    const verifier = new TokenVerifier({ getIssuerPublicKey: async () => wrong.publicKey });
    await expect(verifier.verify(encoded, 'read:kb-docs')).rejects.toThrow(InvalidSignatureError);
  });

  it('rejects expired token', async () => {
    const iss = await newScope();
    let t = 1_000_000;
    const { encoded } = await issueToken({
      issuerScopeId: iss.scopeId, issuerPrivateKey: iss.privateKey,
      subjectScopeId: iss.scopeId, audienceScopeId: iss.scopeId,
      caps: ['read:kb-docs'], ttlSeconds: 60, now: () => t,
    });
    t += 3600;
    const verifier = new TokenVerifier({
      getIssuerPublicKey: async () => iss.publicKey,
      now: () => t, clockSkewSeconds: 5,
    });
    await expect(verifier.verify(encoded, 'read:kb-docs')).rejects.toThrow(TokenExpiredError);
  });

  it('rejects not-yet-valid token', async () => {
    const iss = await newScope();
    let t = 1_000_000;
    const { encoded } = await issueToken({
      issuerScopeId: iss.scopeId, issuerPrivateKey: iss.privateKey,
      subjectScopeId: iss.scopeId, audienceScopeId: iss.scopeId,
      caps: ['read:kb-docs'], ttlSeconds: 3600, notBeforeSeconds: 1000, now: () => t,
    });
    const verifier = new TokenVerifier({
      getIssuerPublicKey: async () => iss.publicKey,
      now: () => t, clockSkewSeconds: 5,
    });
    await expect(verifier.verify(encoded, 'read:kb-docs')).rejects.toThrow(TokenNotYetValidError);
  });

  it('rejects revoked token', async () => {
    const iss = await newScope();
    const { token, encoded } = await issueToken({
      issuerScopeId: iss.scopeId, issuerPrivateKey: iss.privateKey,
      subjectScopeId: iss.scopeId, audienceScopeId: iss.scopeId,
      caps: ['read:kb-docs'], ttlSeconds: 3600,
    });
    const store = new RevocationStore(root);
    await store.revoke(token.payload.jti as any, 'leaked', iss.scopeId);
    const verifier = new TokenVerifier({
      getIssuerPublicKey: async () => iss.publicKey,
      revocationStore: store,
    });
    await expect(verifier.verify(encoded, 'read:kb-docs')).rejects.toThrow(TokenRevokedError);
  });

  it('rejects insufficient capability', async () => {
    const iss = await newScope();
    const { encoded } = await issueToken({
      issuerScopeId: iss.scopeId, issuerPrivateKey: iss.privateKey,
      subjectScopeId: iss.scopeId, audienceScopeId: iss.scopeId,
      caps: ['read:kb-docs'], ttlSeconds: 3600,
    });
    const verifier = new TokenVerifier({ getIssuerPublicKey: async () => iss.publicKey });
    await expect(verifier.verify(encoded, 'write:kb-docs')).rejects.toThrow(InsufficientCapabilityError);
  });

  it('delegation: child cannot exceed parent caps', async () => {
    const rootScope = await newScope();
    const mid = await newScope();
    const { token: parent } = await issueToken({
      issuerScopeId: rootScope.scopeId, issuerPrivateKey: rootScope.privateKey,
      subjectScopeId: mid.scopeId, audienceScopeId: rootScope.scopeId,
      caps: ['delegate:*', 'read:kb-docs'], ttlSeconds: 3600, maxDelegationDepth: 2,
    });
    await expect(
      delegateToken({
        parentToken: parent, parentPrivateKey: mid.privateKey,
        newSubjectScopeId: rootScope.scopeId,
        caps: ['write:kb-docs'], ttlSeconds: 60,
      }),
    ).rejects.toThrow(InsufficientCapabilityError);
  });

  it('delegation: child token verifies with parent subject as issuer', async () => {
    const rootScope = await newScope();
    const mid = await newScope();
    const leaf = await newScope();
    const { token: parent } = await issueToken({
      issuerScopeId: rootScope.scopeId, issuerPrivateKey: rootScope.privateKey,
      subjectScopeId: mid.scopeId, audienceScopeId: rootScope.scopeId,
      caps: ['delegate:*', 'read:*'], ttlSeconds: 3600, maxDelegationDepth: 2,
    });
    const { encoded: childEncoded } = await delegateToken({
      parentToken: parent, parentPrivateKey: mid.privateKey,
      newSubjectScopeId: leaf.scopeId,
      caps: ['read:kb-docs'], ttlSeconds: 600,
    });
    const verifier = new TokenVerifier({
      getIssuerPublicKey: async (kid) =>
        kid === rootScope.scopeId ? rootScope.publicKey :
        kid === mid.scopeId ? mid.publicKey : null,
    });
    const ok = await verifier.verify(childEncoded, 'read:kb-docs');
    expect(ok.payload.maxDelegationDepth).toBe(1);
    expect(ok.payload.iss).toBe(mid.scopeId);
  });
});
