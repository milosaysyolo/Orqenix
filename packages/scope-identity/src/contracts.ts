// SPDX-License-Identifier: Apache-2.0
import { z } from "zod";
import { OrqenixError, type Brand } from "@orqenix/core";

export type ScopeId = Brand<string, "ScopeId">;

export const SCOPE_ID_PATTERN = /^scope:[A-Z2-7]{32}$/;

export function isScopeId(value: unknown): value is ScopeId {
  return typeof value === "string" && SCOPE_ID_PATTERN.test(value);
}

export interface Ed25519KeyPair {
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
}

export const ScopeYamlSchema = z
  .object({
    schemaVersion: z.literal(1),
    scopeId: z.string().regex(SCOPE_ID_PATTERN, "invalid scopeId format"),
    name: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "name must be kebab-case"),
    publicKey: z
      .string()
      .regex(/^[A-Za-z0-9+/]{43}=$/, "publicKey must be base64-encoded 32 bytes (44 chars)"),
    createdAt: z.string().datetime({ offset: true }),
    parentScope: z.union([z.string().regex(SCOPE_ID_PATTERN), z.null()]),
    metadata: z
      .object({
        description: z.string().max(512).optional(),
        tags: z.array(z.string().min(1).max(64)).max(16).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export type ScopeYaml = z.infer<typeof ScopeYamlSchema>;

export class InvalidScopeIdError extends OrqenixError {
  override readonly code = "INVALID_SCOPE_ID";
  constructor(value: unknown) {
    super(
      `invalid scope id: ${typeof value === "string" ? value : typeof value}`,
      "INVALID_SCOPE_ID",
    );
  }
}

export class InvalidScopeYamlError extends OrqenixError {
  override readonly code = "INVALID_SCOPE_YAML";
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[] = [],
  ) {
    super(`invalid scope.yaml: ${message}`, "INVALID_SCOPE_YAML");
  }
}

export class KeyPairMismatchError extends OrqenixError {
  override readonly code = "KEYPAIR_MISMATCH";
  constructor() {
    super(
      "public key in scope.yaml does not match the private key in identity.key",
      "KEYPAIR_MISMATCH",
    );
  }
}

export class ScopeYamlCorruptError extends OrqenixError {
  override readonly code = "SCOPE_YAML_CORRUPT";
  constructor(reason: string) {
    super(`scope.yaml integrity check failed: ${reason}`, "SCOPE_YAML_CORRUPT");
  }
}
