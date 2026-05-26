import { appendFile } from "node:fs/promises";
import { sign, KeyObject } from "node:crypto";
import { stringify as yamlStringify } from "yaml";

export interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  artifact?: string;
  details?: Record<string, unknown>;
}

export async function appendAudit(
  path: string,
  entry: AuditEntry,
  signingKey: KeyObject,
) {
  const body = yamlStringify(entry).trim();
  const sig = sign(null, Buffer.from(body), signingKey).toString("base64");
  await appendFile(path, `---\n${body}\nsignature: ed25519:${sig}\n`);
}
