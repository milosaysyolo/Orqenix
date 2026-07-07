import {
  CapabilityError,
  ErrorCode,
  type CapabilityToken,
  type ErrorCodeValue,
  type ScopeId,
} from "@orqenix/mesh-transport-core";
import { b64urlDecode, ed25519Verify, importEd25519PublicKey } from "./ed25519.js";
import {
  canonicalSigningBytes,
  decodeCapabilityToken,
  type CapabilityTokenFields,
} from "./capability-token.js";
import { LRUKeyStore } from "./key-store.js";
import { compileGlob, matches } from "./glob.js";

export interface VerifyInput {
  capability: CapabilityToken | string;
  fromScope: ScopeId;
  toScope: ScopeId;
  method: string;
  now?: () => number;
}

export interface VerifyOk {
  ok: true;
  token: CapabilityTokenFields;
}
export interface VerifyDenied {
  ok: false;
  code: string;
  message: string;
}
export type VerifyResult = VerifyOk | VerifyDenied;

export type DelegationHook = (token: CapabilityTokenFields) => Promise<VerifyResult>;

export interface CapabilityVerifierOptions {
  keyStore: LRUKeyStore;
  delegation?: DelegationHook;
}

export class CapabilityVerifier {
  private readonly keyStore: LRUKeyStore;
  private readonly delegation?: DelegationHook;
  private globCache = new Map<string, ReturnType<typeof compileGlob>>();

  constructor(opts: CapabilityVerifierOptions) {
    this.keyStore = opts.keyStore;
    this.delegation = opts.delegation;
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const now = (input.now ?? Date.now)();

    let token: CapabilityTokenFields;
    try {
      if (
        !input.capability ||
        (typeof input.capability === "string" && input.capability.length === 0)
      ) {
        return denied(ErrorCode.CAP_MISSING, "capability missing");
      }
      token = decodeCapabilityToken(String(input.capability));
    } catch (e) {
      return denied(ErrorCode.CAP_MALFORMED, sanitizeMessage(String((e as Error).message)));
    }

    if (token.nbf !== undefined && now < token.nbf) {
      return denied(ErrorCode.CAP_EXPIRED, "token not yet valid");
    }
    if (now >= token.exp) {
      return denied(ErrorCode.CAP_EXPIRED, "token expired");
    }

    const pubRaw = await this.keyStore.get(token.iss);
    if (!pubRaw) {
      return denied(ErrorCode.CAP_SIG_INVALID, "signature invalid");
    }
    let sigOk = false;
    try {
      const publicKey = await importEd25519PublicKey(pubRaw);
      const sigBytes = b64urlDecode(token.sig);
      const signed = canonicalSigningBytes(token);
      sigOk = await ed25519Verify(publicKey, sigBytes, signed);
    } catch {
      sigOk = false;
    }
    if (!sigOk) return denied(ErrorCode.CAP_SIG_INVALID, "signature invalid");

    if (token.sub !== input.fromScope) {
      return denied(ErrorCode.CAP_SUBJECT_MISMATCH, "subject mismatch");
    }
    if (token.iss !== input.toScope) {
      return denied(ErrorCode.CAP_ISSUER_MISMATCH, "issuer mismatch");
    }

    if (!this.methodAllowed(token.caps, input.method)) {
      return denied(ErrorCode.CAP_METHOD_NOT_ALLOWED, "method not allowed");
    }

    if (this.delegation) {
      const r = await this.delegation(token);
      if (!r.ok) return r;
    }

    return { ok: true, token };
  }

  private methodAllowed(caps: ReadonlyArray<string>, method: string): boolean {
    for (const c of caps) {
      let g = this.globCache.get(c);
      if (!g) {
        try {
          g = compileGlob(c);
        } catch {
          continue;
        }
        this.globCache.set(c, g);
      }
      if (matches(g, method)) return true;
    }
    return false;
  }
}

export function throwOnDenied(result: VerifyResult): asserts result is VerifyOk {
  if (!result.ok) {
    throw new CapabilityError(result.message, result.code as ErrorCodeValue);
  }
}

function denied(code: string, message: string): VerifyDenied {
  return { ok: false, code, message };
}

function sanitizeMessage(s: string): string {
  return s.split("\n")[0].slice(0, 160);
}
