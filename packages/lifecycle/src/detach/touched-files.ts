import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

interface Ledger {
  schema_version: "1.0";
  created: Array<{
    path: string;
    hash_at_create: string;
    at: string;
    by: string;
  }>;
  modified: Array<{
    path: string;
    fenced_block_id: string;
    original_hash_before_block: string;
    applied_at: string;
    by: string;
  }>;
}

export async function recordCreated(
  ledgerPath: string,
  path: string,
  content: Buffer,
  by: string,
) {
  const ledger = await loadLedger(ledgerPath);
  ledger.created.push({
    path,
    hash_at_create:
      "sha256:" + createHash("sha256").update(content).digest("hex"),
    at: new Date().toISOString(),
    by,
  });
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
}

async function loadLedger(p: string): Promise<Ledger> {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return { schema_version: "1.0", created: [], modified: [] };
  }
}
