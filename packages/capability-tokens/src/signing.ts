import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import {
  type CapabilityToken,
  type TokenHeader,
  type TokenPayload,
  InvalidSignatureError,
} from './contracts.js';
import { canonicalSigningInput } from './format.js';

ed.etc.sha512Sync = (...msgs) => sha512(ed.etc.concatBytes(...msgs));

export interface SignTokenInput {
  header: TokenHeader;
  payload: TokenPayload;
  privateKey: Uint8Array;
}

export async function signToken(input: SignTokenInput): Promise<CapabilityToken> {
  if (input.privateKey.length !== 32) {
    throw new Error(`Ed25519 private key must be 32 bytes, got ${input.privateKey.length}`);
  }
  const message = canonicalSigningInput(input.header, input.payload);
  const signature = await ed.signAsync(message, input.privateKey);
  return { header: input.header, payload: input.payload, signature };
}

export async function verifyTokenSignature(
  token: CapabilityToken,
  publicKey: Uint8Array,
): Promise<boolean> {
  if (publicKey.length !== 32) return false;
  if (token.signature.length !== 64) return false;
  const message = canonicalSigningInput(token.header, token.payload);
  try {
    return await ed.verifyAsync(token.signature, message, publicKey);
  } catch {
    return false;
  }
}

export async function verifyTokenSignatureOrThrow(
  token: CapabilityToken,
  publicKey: Uint8Array,
): Promise<void> {
  const ok = await verifyTokenSignature(token, publicKey);
  if (!ok) throw new InvalidSignatureError();
}
