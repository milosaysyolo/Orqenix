// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , Capability token
//
// Extends Phase 6 capability tokens to MCP clients. Each client connection
// presents a token scoped to a project + permissions. Per CR v8.0 Section 9.2.5.

import { blake3 } from "@noble/hashes/blake3";
import { z } from "zod";

export const McpCapabilityTokenSchema = z.object({
  /** Project scope this token grants access to */
  scope_id: z.string(),
  /** Identifies the agent platform (e.g., 'claude-code') */
  client_id: z.string(),
  /** Granted permissions (resource.action[:scope]) */
  permissions: z.array(z.string()),
  /** ISO issued timestamp */
  issued_at: z.string().datetime(),
  /** ISO expiry timestamp */
  expires_at: z.string().datetime(),
  /** Ed25519 signature over the token body (base64) */
  signature: z.string(),
});

export type McpCapabilityToken = z.infer<typeof McpCapabilityTokenSchema>;

export interface TokenVerifyResult {
  valid: boolean;
  reason?: string;
  token?: McpCapabilityToken;
}

/**
 * Verifies an MCP capability token.
 *
 * For Phase 8 D8.α.7, signature verification uses the project's Ed25519 public
 * key (from scope identity). The actual Ed25519 verify is delegated to the
 * caller-provided verifier to keep this package dependency-light.
 */
export class CapabilityTokenVerifier {
  constructor(private readonly verifySignature: (body: string, signature: string) => boolean) {}

  verify(rawToken: unknown): TokenVerifyResult {
    const parsed = McpCapabilityTokenSchema.safeParse(rawToken);
    if (!parsed.success) {
      return { valid: false, reason: "TOKEN_MALFORMED" };
    }
    const token = parsed.data;

    // Expiry check
    if (token.expires_at < new Date().toISOString()) {
      return { valid: false, reason: "TOKEN_EXPIRED", token };
    }

    // Signature check (over canonical body without signature field)
    const body = this.canonicalBody(token);
    if (!this.verifySignature(body, token.signature)) {
      return { valid: false, reason: "SIGNATURE_INVALID", token };
    }

    return { valid: true, token };
  }

  /** Checks whether the token grants a permission (with prefix matching) */
  hasPermission(token: McpCapabilityToken, requested: string): boolean {
    if (token.permissions.includes(requested)) return true;
    // Prefix match for scoped permissions
    const [reqRes, reqScope] = this.split(requested);
    if (reqScope === undefined) return false;
    for (const granted of token.permissions) {
      const [gRes, gScope] = this.split(granted);
      if (gRes !== reqRes) continue;
      if (gScope === undefined) return true;
      if (reqScope === gScope || reqScope.startsWith(gScope + "/")) return true;
    }
    return false;
  }

  private canonicalBody(token: McpCapabilityToken): string {
    return JSON.stringify({
      scope_id: token.scope_id,
      client_id: token.client_id,
      permissions: [...token.permissions].sort(),
      issued_at: token.issued_at,
      expires_at: token.expires_at,
    });
  }

  private split(p: string): [string, string | undefined] {
    const idx = p.indexOf(":");
    if (idx === -1) return [p, undefined];
    return [p.slice(0, idx), p.slice(idx + 1)];
  }
}

/** Computes a token fingerprint for audit (non-sensitive) */
export function tokenFingerprint(token: McpCapabilityToken): string {
  const body = JSON.stringify({ scope: token.scope_id, client: token.client_id });
  const h = blake3(new TextEncoder().encode(body));
  return Array.from(h)
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
