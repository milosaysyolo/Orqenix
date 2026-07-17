// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { OrqenixError, type Brand } from "@orqenix/core";
import { SCOPE_ID_PATTERN } from "@orqenix/scope-identity";

export type TokenId = Brand<string, "TokenId">;
export const TOKEN_ID_PATTERN = /^tok:[A-Z2-7]{32}$/;

export const ACTIONS = ["read", "write", "delegate", "query", "distill", "mesh"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "kb-docs",
  "kb-code",
  "kb-chat",
  "kb-decisions",
  "audit-log",
  "*",
] as const;
export type Resource = (typeof RESOURCES)[number];

export const CAPABILITY_PATTERN =
  /^(read|write|delegate|query|distill|mesh):([a-z0-9-]+|\*)(:[a-zA-Z0-9*_./-]+)?$/;

export const CapabilitySchema = z.string().regex(CAPABILITY_PATTERN, "invalid capability format");
export type Capability = z.infer<typeof CapabilitySchema>;

export const TokenHeaderSchema = z
  .object({
    alg: z.literal("EdDSA"),
    typ: z.literal("ORQX"),
    kid: z.string().regex(SCOPE_ID_PATTERN, "kid must be a valid scopeId"),
  })
  .strict();
export type TokenHeader = z.infer<typeof TokenHeaderSchema>;

export const TokenPayloadSchema = z
  .object({
    iss: z.string().regex(SCOPE_ID_PATTERN),
    sub: z.string().regex(SCOPE_ID_PATTERN),
    aud: z.string().regex(SCOPE_ID_PATTERN),
    iat: z.number().int().nonnegative(),
    nbf: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    jti: z.string().regex(TOKEN_ID_PATTERN),
    caps: z.array(CapabilitySchema).min(1).max(64),
    maxDelegationDepth: z.number().int().min(0).max(10),
  })
  .strict()
  .refine((p) => p.exp > p.iat && p.nbf >= p.iat, {
    message: "exp must be > iat and nbf must be >= iat",
  });
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export interface CapabilityToken {
  readonly header: TokenHeader;
  readonly payload: TokenPayload;
  readonly signature: Uint8Array;
}

export type EncodedToken = string & { readonly __brand: "EncodedToken" };

export class InvalidTokenFormatError extends OrqenixError {
  constructor(reason: string) {
    super(`invalid token format: ${reason}`, "INVALID_TOKEN_FORMAT");
  }
}
export class InvalidSignatureError extends OrqenixError {
  constructor() {
    super("token signature does not verify against issuer public key", "INVALID_SIGNATURE");
  }
}
export class TokenExpiredError extends OrqenixError {
  constructor(
    public readonly exp: number,
    public readonly now: number,
  ) {
    super(
      `token expired at ${new Date(exp * 1000).toISOString()}, now is ${new Date(now * 1000).toISOString()}`,
      "TOKEN_EXPIRED",
    );
  }
}
export class TokenNotYetValidError extends OrqenixError {
  constructor(
    public readonly nbf: number,
    public readonly now: number,
  ) {
    super(
      `token not valid until ${new Date(nbf * 1000).toISOString()}, now is ${new Date(now * 1000).toISOString()}`,
      "TOKEN_NOT_YET_VALID",
    );
  }
}
export class TokenRevokedError extends OrqenixError {
  constructor(public readonly jti: TokenId) {
    super(`token ${jti} has been revoked`, "TOKEN_REVOKED");
  }
}
export class InsufficientCapabilityError extends OrqenixError {
  constructor(
    public readonly required: Capability,
    public readonly granted: readonly Capability[],
  ) {
    super(`required capability "${required}" not granted by token`, "INSUFFICIENT_CAPABILITY");
  }
}
export class DelegationDepthExceededError extends OrqenixError {
  constructor(
    public readonly current: number,
    public readonly max: number,
  ) {
    super(`delegation depth ${current} exceeds max ${max}`, "DELEGATION_DEPTH_EXCEEDED");
  }
}
export class UnknownIssuerError extends OrqenixError {
  constructor(public readonly kid: string) {
    super(`issuer scope ${kid} not known to verifier`, "UNKNOWN_ISSUER");
  }
}
