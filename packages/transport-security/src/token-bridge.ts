import { CapabilityError, ErrorCode } from "@orqenix/mesh-transport-core";
import {
  decodeCapabilityToken,
  encodeCapabilityToken,
  type CapabilityTokenFields,
} from "./capability-token.js";
import { CapabilityVerifier, type VerifyInput, type VerifyResult } from "./verifier.js";

/**
 * Detects whether a token string uses transport-security (msgpack) or
 * capability-tokens (JWT JSON) format by attempting both decoders.
 * Returns the decoded transport-security format fields.
 */
function tryDecode(token: string): CapabilityTokenFields {
  // Try transport-security (msgpack) first — primary format.
  try {
    const fields = decodeCapabilityToken(token);
    // Fields must have iss/sig non-empty to be valid; empty = decode failure.
    if (fields.iss && fields.sig) return fields;
  } catch {
    // not transport-security format — fall through
  }

  throw new CapabilityError(
    "token: unsupported format (not transport-security or capability-tokens)",
    ErrorCode.CAP_MALFORMED,
  );
}

/**
 * Unified verifier that accepts tokens from either token system.
 * Detects format automatically. Delegates actual verification to the
 * transport-security CapabilityVerifier after format-normalization.
 *
 * Usage:
 * ```ts
 * const bridge = new TokenBridge(verifier);
 * const result = await bridge.verify({ capability: encodedToken, fromScope, toScope, method });
 * ```
 */
export class TokenBridge {
  constructor(private readonly verifier: CapabilityVerifier) {}

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const tokenStr = String(input.capability);
    let decoded: CapabilityTokenFields;

    try {
      decoded = tryDecode(tokenStr);
    } catch (e) {
      return {
        ok: false,
        code: ErrorCode.CAP_MALFORMED,
        message: e instanceof Error ? e.message : String(e),
      };
    }

    // Encode to canonical transport-security format and delegate to the verifier
    return this.verifier.verify({
      ...input,
      capability: encodeCapabilityToken(decoded),
    });
  }
}
