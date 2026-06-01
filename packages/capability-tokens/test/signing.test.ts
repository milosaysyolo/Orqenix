import { describe, it, expect } from 'vitest';
import { generateKeyPair, deriveScopeId } from '@orqenix/scope-identity';
import { signToken, verifyTokenSignature, verifyTokenSignatureOrThrow } from '../src/signing';
import { computeJti } from '../src/format';
import { InvalidSignatureError, type TokenHeader, type TokenPayload } from '../src/contracts';

async function makeToken() {
  const { publicKey, privateKey } = await generateKeyPair();
  const iss = deriveScopeId(publicKey);
  const header: TokenHeader = { alg: 'EdDSA', typ: 'ORQX', kid: iss };
  const payloadNoJti = {
    iss, sub: iss, aud: iss,
    iat: 1000, nbf: 1000, exp: 2000,
    caps: ['read:kb-docs'], maxDelegationDepth: 0,
  } as Omit<TokenPayload, 'jti'>;
  const payload = { ...payloadNoJti, jti: computeJti(payloadNoJti) } as TokenPayload;
  return { header, payload, publicKey, privateKey };
}

describe('signing', () => {
  it('signs and verifies a valid token', async () => {
    const { header, payload, publicKey, privateKey } = await makeToken();
    const token = await signToken({ header, payload, privateKey });
    expect(token.signature).toHaveLength(64);
    expect(await verifyTokenSignature(token, publicKey)).toBe(true);
  });

  it('rejects signature verified against wrong public key', async () => {
    const { header, payload, privateKey } = await makeToken();
    const other = await generateKeyPair();
    const token = await signToken({ header, payload, privateKey });
    expect(await verifyTokenSignature(token, other.publicKey)).toBe(false);
  });

  it('rejects tampered payload', async () => {
    const { header, payload, publicKey, privateKey } = await makeToken();
    const token = await signToken({ header, payload, privateKey });
    const tampered = { ...token, payload: { ...token.payload, exp: 9999 } };
    expect(await verifyTokenSignature(tampered, publicKey)).toBe(false);
  });

  it('verifyTokenSignatureOrThrow throws InvalidSignatureError on bad sig', async () => {
    const { header, payload, privateKey } = await makeToken();
    const other = await generateKeyPair();
    const token = await signToken({ header, payload, privateKey });
    await expect(verifyTokenSignatureOrThrow(token, other.publicKey)).rejects.toThrow(InvalidSignatureError);
  });

  it('rejects non-32-byte public key', async () => {
    const { header, payload, privateKey } = await makeToken();
    const token = await signToken({ header, payload, privateKey });
    expect(await verifyTokenSignature(token, new Uint8Array(16))).toBe(false);
  });
});
