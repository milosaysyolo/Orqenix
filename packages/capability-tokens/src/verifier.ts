import {
  type Capability,
  type CapabilityToken,
  TokenExpiredError,
  TokenNotYetValidError,
  UnknownIssuerError,
} from "./contracts.js";
import { decodeToken } from "./format.js";
import { verifyTokenSignatureOrThrow } from "./signing.js";
import { requireCapability } from "./permissions.js";
import { RevocationStore } from "./revocation.js";

export interface TokenVerifierOptions {
  getIssuerPublicKey: (kid: string) => Promise<Uint8Array | null>;
  revocationStore?: RevocationStore;
  clockSkewSeconds?: number;
  now?: () => number;
}

const DEFAULT_SKEW_SECONDS = 30;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export class TokenVerifier {
  private readonly skew: number;
  private readonly now: () => number;
  constructor(private readonly opts: TokenVerifierOptions) {
    this.skew = opts.clockSkewSeconds ?? DEFAULT_SKEW_SECONDS;
    this.now = opts.now ?? nowSec;
  }

  async verifyWithoutCapability(encoded: string): Promise<CapabilityToken> {
    const token = decodeToken(encoded);
    const pubKey = await this.opts.getIssuerPublicKey(token.header.kid);
    if (!pubKey) throw new UnknownIssuerError(token.header.kid);
    await verifyTokenSignatureOrThrow(token, pubKey);

    const t = this.now();
    if (t + this.skew < token.payload.nbf) throw new TokenNotYetValidError(token.payload.nbf, t);
    if (t - this.skew > token.payload.exp) throw new TokenExpiredError(token.payload.exp, t);

    if (this.opts.revocationStore) {
      await this.opts.revocationStore.requireNotRevoked(token.payload.jti as any);
    }
    return token;
  }

  async verify(encoded: string, required: Capability): Promise<CapabilityToken> {
    const token = await this.verifyWithoutCapability(encoded);
    requireCapability(token, required);
    return token;
  }
}
