import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { concatBytes } from '@noble/hashes/utils';
import type { Ed25519KeyPair } from './contracts.js';

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

ed.etc!.sha512Sync = (...msgs: Uint8Array[]) => sha512(concatBytes(...msgs));

const PEM_HEADER = '-----BEGIN ORQENIX ED25519 PRIVATE KEY-----';
const PEM_FOOTER = '-----END ORQENIX ED25519 PRIVATE KEY-----';

export async function generateKeyPair(): Promise<Ed25519KeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { privateKey, publicKey };
}

export async function derivePublicKey(privateKey: Uint8Array): Promise<Uint8Array> {
  if (privateKey.length !== 32) {
    throw new Error(`Ed25519 private key must be 32 bytes, got ${privateKey.length}`);
  }
  return ed.getPublicKeyAsync(privateKey);
}

export function serializePublicKey(pub: Uint8Array): string {
  if (pub.length !== 32) throw new Error(`Ed25519 public key must be 32 bytes, got ${pub.length}`);
  return Buffer.from(pub).toString('base64');
}

export function deserializePublicKey(b64: string): Uint8Array {
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length !== 32) {
    throw new Error(`decoded public key must be 32 bytes, got ${bytes.length}`);
  }
  return new Uint8Array(bytes);
}

export function serializePrivateKey(priv: Uint8Array): string {
  if (priv.length !== 32) throw new Error(`Ed25519 private key must be 32 bytes, got ${priv.length}`);
  const b64 = Buffer.from(priv).toString('base64');
  const wrapped = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `${PEM_HEADER}\n${wrapped}\n${PEM_FOOTER}\n`;
}

export function deserializePrivateKey(pem: string): Uint8Array {
  const trimmed = pem.trim();
  if (!trimmed.startsWith(PEM_HEADER) || !trimmed.endsWith(PEM_FOOTER)) {
    throw new Error('PEM header/footer mismatch for ORQENIX ED25519 PRIVATE KEY');
  }
  const body = trimmed.slice(PEM_HEADER.length, trimmed.length - PEM_FOOTER.length);
  const b64 = body.replace(/\s+/g, '');
  const bytes = Buffer.from(b64, 'base64');
  if (bytes.length !== 32) {
    throw new Error(`decoded private key must be 32 bytes, got ${bytes.length}`);
  }
  return new Uint8Array(bytes);
}

export async function verifyKeyPair(pair: Ed25519KeyPair): Promise<boolean> {
  if (pair.publicKey.length !== 32 || pair.privateKey.length !== 32) return false;
  const derived = await derivePublicKey(pair.privateKey);
  return constantTimeEqual(derived, pair.publicKey);
}
