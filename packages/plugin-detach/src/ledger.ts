import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";

export interface LedgerEntry {
  path: string;
  action: "created" | "modified";
  sha: string;
  touchedAt: number;
}

export interface Ledger {
  version: 1;
  entries: LedgerEntry[];
}

export function createLedger(): Ledger {
  return { version: 1, entries: [] };
}

export function recordTouch(
  ledger: Ledger,
  path: string,
  action: "created" | "modified",
  sha: string,
  now: number = Date.now()
): void {
  const existing = ledger.entries.findIndex((e) => e.path === path);
  const entry: LedgerEntry = { path, action, sha, touchedAt: now };
  if (existing >= 0) ledger.entries[existing] = entry;
  else ledger.entries.push(entry);
}

export async function loadLedger(path: string): Promise<Ledger> {
  try {
    await access(path);
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return createLedger();
  }
}

export async function saveLedger(path: string, ledger: Ledger): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(ledger, null, 2));
}

export function filterCreated(ledger: Ledger): LedgerEntry[] {
  return ledger.entries.filter((e) => e.action === "created");
}

export function filterModified(ledger: Ledger): LedgerEntry[] {
  return ledger.entries.filter((e) => e.action === "modified");
}
