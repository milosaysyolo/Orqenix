import type { ScopeId } from "@orqenix/mesh-transport-core";
import { b64urlEncode, ed25519Sign } from "./ed25519.js";

export interface Ed25519SignerOptions {
  fromScope: ScopeId;
  privateKey: CryptoKey;
}

export class Ed25519Signer {
  readonly fromScope: ScopeId;
  private readonly privateKey: CryptoKey;

  constructor(opts: Ed25519SignerOptions) {
    this.fromScope = opts.fromScope;
    this.privateKey = opts.privateKey;
  }

  async signScopeProof(requestId: string, toScope: ScopeId): Promise<string> {
    const canonical = new TextEncoder().encode(`${requestId}.${toScope}`);
    const sig = await ed25519Sign(this.privateKey, canonical);
    return b64urlEncode(sig);
  }
}

export type SignFn = (requestId: string, toScope: ScopeId) => Promise<string>;

export function makeSignFn(signer: Ed25519Signer): SignFn {
  return (requestId, toScope) => signer.signScopeProof(requestId, toScope);
}
