import { z } from "zod";
import { verify } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Registry } from "@orqenix/registry";

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

export interface InstallOpts {
  registry: Registry;
  policy?: {
    requireSignature?: boolean;
  };
  publicKey?: string;
}

export async function install(ref: string, opts: InstallOpts): Promise<void> {
  const [name, version] = ref.split("@");
  if (!name || !version) {
    throw new Error(`Invalid plugin reference: ${ref}`);
  }

  const conflicts = await opts.registry.checkConflicts({
    id: ref,
    name: name,
    version: version,
    type: "skill",
    state: "ACTIVE",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (conflicts.length > 0) {
    throw new Error(`Conflicts detected: ${conflicts.map(c => c.id).join(", ")}`);
  }

  await opts.registry.add({
    id: ref,
    name: name,
    version: version,
    type: "skill",
    state: "ACTIVE",
  });
}

export async function uninstall(
  ref: string,
  opts: { registry: Registry; purge?: boolean } = { registry: null as any },
): Promise<void> {
  if (!opts.registry) {
    throw new Error("Registry required for uninstall");
  }

  const entry = await opts.registry.get(ref);
  if (!entry) {
    throw new Error(`Plugin not found: ${ref}`);
  }

  if (opts.purge) {
    await opts.registry.purge(ref);
  } else {
    await opts.registry.remove(ref);
  }
}
