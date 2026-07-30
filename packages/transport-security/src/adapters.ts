// SPDX-License-Identifier: Apache-2.0
import type { ScopeId } from "@orqenix/mesh-transport-core";
import { b64urlDecode, ed25519Verify, importEd25519PublicKey } from "./ed25519.js";
import { LRUKeyStore } from "./key-store.js";

export interface StructuralIdentityVerifier {
  verifyScopeSig(
    fromScope: ScopeId,
    requestIdOrNonce: string,
    toScope: ScopeId,
    sigB64u: string,
  ): Promise<boolean>;
}

export interface Ed25519IdentityVerifierOptions {
  keyStore: LRUKeyStore;
}

export class Ed25519IdentityVerifier implements StructuralIdentityVerifier {
  private readonly keyStore: LRUKeyStore;
  constructor(opts: Ed25519IdentityVerifierOptions) {
    this.keyStore = opts.keyStore;
  }

  async verifyScopeSig(
    fromScope: ScopeId,
    requestIdOrNonce: string,
    toScope: ScopeId,
    sigB64u: string,
  ): Promise<boolean> {
    if (!fromScope || !requestIdOrNonce || !toScope || !sigB64u) return false;
    const pubRaw = await this.keyStore.get(fromScope);
    if (!pubRaw) return false;
    try {
      const publicKey = await importEd25519PublicKey(pubRaw);
      const sigBytes = b64urlDecode(sigB64u);
      const message = new TextEncoder().encode(`${requestIdOrNonce}.${toScope}`);
      return await ed25519Verify(publicKey, sigBytes, message);
    } catch {
      return false;
    }
  }
}

export function makeEd25519IdentityVerifier(keyStore: LRUKeyStore): Ed25519IdentityVerifier {
  return new Ed25519IdentityVerifier({ keyStore });
}
