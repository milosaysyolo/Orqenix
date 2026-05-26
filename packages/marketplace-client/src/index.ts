import { z } from "zod";
import { verify } from "node:crypto";
import { readFileSync } from "node:fs";

export const PluginEntry = z.object({
  name: z.string(),
  version: z.string(),
  category: z.string().optional(),
  source: z.union([
    z.string(),
    z.object({
      source: z.enum(["url", "git-subdir"]),
      url: z.string().url(),
      sha: z.string().regex(/^[a-f0-9]{40}$/),
      ref: z.string().optional(),
      path: z.string().optional(),
    }),
  ]),
  author: z.object({ name: z.string() }),
  homepage: z.string().url().optional(),
  signature: z
    .object({
      sig: z.string(),
      signed_at: z.string(),
    })
    .optional(),
  compat: z
    .object({
      orqenix_min: z.string(),
    })
    .optional(),
});

export const Marketplace = z.object({
  schemaVersion: z.literal("1.0"),
  name: z.string(),
  owner: z.object({
    name: z.string(),
    signing_key_fingerprint: z.string(),
  }),
  tier: z.enum([
    "orqenix-verified",
    "anthropic-verified",
    "partner-attested",
    "verified-by-org",
    "community",
  ]),
  plugins: z.array(PluginEntry),
});

export function verifySignature(
  body: Buffer,
  signatureBase64: string,
  publicKeyPemPath: string,
): boolean {
  const pubKey = readFileSync(publicKeyPemPath);
  return verify(null, body, pubKey, Buffer.from(signatureBase64, "base64"));
}

export async function install(_ref: string): Promise<void> {
  return;
}

export async function uninstall(
  _ref: string,
  _opts?: { purge?: boolean },
): Promise<void> {
  return;
}
