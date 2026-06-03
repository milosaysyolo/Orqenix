import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  ScopeYamlSchema,
  type ScopeYaml,
  InvalidScopeYamlError,
  KeyPairMismatchError,
  ScopeYamlCorruptError,
} from "./contracts.js";
import { deriveScopeId } from "./scope-id.js";
import { serializePublicKey } from "./keypair.js";

const CANONICAL_KEY_ORDER: Array<keyof ScopeYaml> = [
  "schemaVersion",
  "scopeId",
  "name",
  "publicKey",
  "createdAt",
  "parentScope",
  "metadata",
];

export function parseScopeYaml(raw: string): ScopeYaml {
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (e) {
    throw new InvalidScopeYamlError(`YAML parse error: ${(e as Error).message}`);
  }
  const result = ScopeYamlSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvalidScopeYamlError(result.error.message, result.error.issues);
  }
  return result.data;
}

export function serializeScopeYaml(value: ScopeYaml): string {
  const ordered: Record<string, unknown> = {};
  for (const key of CANONICAL_KEY_ORDER) ordered[key] = value[key];
  return stringifyYaml(ordered, { sortMapEntries: false, lineWidth: 0 });
}

export async function loadScopeYaml(path: string): Promise<ScopeYaml> {
  const raw = await readFile(path, "utf-8");
  return parseScopeYaml(raw);
}

export async function saveScopeYaml(path: string, value: ScopeYaml): Promise<void> {
  const yaml = serializeScopeYaml(value);
  const tmp = join(dirname(path), `.${Date.now()}.scope.yaml.tmp`);
  await writeFile(tmp, yaml, { encoding: "utf-8", mode: 0o644 });
  await rename(tmp, path);
}

export function verifyScopeYamlConsistency(yaml: ScopeYaml, publicKey: Uint8Array): void {
  const expectedB64 = serializePublicKey(publicKey);
  if (yaml.publicKey !== expectedB64) {
    throw new KeyPairMismatchError();
  }
  const expectedId = deriveScopeId(publicKey);
  if (yaml.scopeId !== expectedId) {
    throw new ScopeYamlCorruptError(
      `scopeId mismatch: yaml has ${yaml.scopeId}, derived from publicKey is ${expectedId}`,
    );
  }
}
