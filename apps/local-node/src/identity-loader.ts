import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import {
  importEd25519PrivateKey,
  importEd25519PublicKey,
  exportEd25519PublicKeyRaw,
} from '@orqenix/transport-security';
import type { ScopeId } from '@orqenix/mesh-transport-core';

export interface LocalIdentity {
  scopeId: ScopeId;
  publicKey: CryptoKey;
  publicKeyRaw: Uint8Array;
  privateKey: CryptoKey;
  scopeSeed: Uint8Array;
}

export async function loadLocalIdentity(scopeYamlPath: string, privatePemPath: string): Promise<LocalIdentity> {
  const scopeRaw = parseYaml(await readFile(scopeYamlPath, 'utf8')) as unknown;
  if (!scopeRaw || typeof scopeRaw !== 'object') throw new Error('scope.yaml: not an object');
  const s = scopeRaw as Record<string, unknown>;

  const scopeId = s.scope_id ?? s.scopeId;
  if (typeof scopeId !== 'string' || scopeId.length === 0) {
    throw new Error('scope.yaml: scope_id required');
  }
  const pubB64 = s.public_key_b64 ?? s.publicKeyB64;
  if (typeof pubB64 !== 'string' || pubB64.length === 0) {
    throw new Error('scope.yaml: public_key_b64 required');
  }
  const publicKeyRaw = base64ToBytes(pubB64);
  if (publicKeyRaw.length !== 32) {
    throw new Error('scope.yaml: public_key_b64 must decode to 32 bytes');
  }

  const seed = await loadSeedFromPem(privatePemPath);
  const publicKey = await importEd25519PublicKey(publicKeyRaw);
  const privateKey = await importEd25519PrivateKey(seed);

  return {
    scopeId: scopeId as ScopeId,
    publicKey,
    publicKeyRaw,
    privateKey,
    scopeSeed: seed,
  };
}

async function loadSeedFromPem(path: string): Promise<Uint8Array> {
  const text = await readFile(path, 'utf8');
  const match = /-----BEGIN ORQENIX ED25519 SEED-----([\s\S]+?)-----END ORQENIX ED25519 SEED-----/.exec(text);
  if (!match) throw new Error('private.pem: ORQENIX ED25519 SEED block not found');
  const body = match[1].replace(/\s+/g, '');
  const bytes = base64ToBytes(body);
  if (bytes.length !== 32) throw new Error('private.pem: seed must be 32 bytes');
  return bytes;
}

function base64ToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}
