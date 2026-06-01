import { applyDelta, decodeFull } from './delta.js';
import { verifyContentHash } from './hash.js';
import { DiffChainError, type DiffEntry } from './contracts.js';

export async function reconstructFromChain(entries: DiffEntry[]): Promise<Uint8Array> {
  if (entries.length === 0) throw new DiffChainError('empty chain');
  const first = entries[0]!;
  if (first.encoding !== 'full' || first.baseHash !== null) {
    throw new DiffChainError('first entry must be full snapshot with baseHash=null');
  }
  let current = await decodeFull(first.payload);
  for (let i = 1; i < entries.length; i++) {
    const e = entries[i]!;
    const prev = entries[i - 1]!;
    if (e.encoding === 'full') {
      if (e.baseHash !== null) throw new DiffChainError(`full entry ${i} must have baseHash=null`);
      current = await decodeFull(e.payload);
      continue;
    }
    if (e.baseHash !== prev.contentHash) {
      throw new DiffChainError(`entry ${i} baseHash ${e.baseHash} does not match prev ${prev.contentHash}`);
    }
    current = await applyDelta(current, e.payload);
  }
  verifyContentHash(current, entries[entries.length - 1]!.contentHash);
  return current;
}

export interface SnapshotPolicy { everyN?: number; maxBytes?: number; }

export function shouldSnapshot(entries: DiffEntry[], policy: SnapshotPolicy = {}): boolean {
  const everyN = policy.everyN ?? 20;
  const maxBytes = policy.maxBytes ?? 64 * 1024;
  let cumulative = 0;
  let depthSinceFull = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.encoding === 'full') break;
    cumulative += entries[i]!.sizeBytes;
    depthSinceFull++;
  }
  return depthSinceFull >= everyN || cumulative >= maxBytes;
}
