import { blake3Bytes } from "@orqenix/core";
import { hashString, type ContentHash } from "@orqenix/storage-diff";
import type { SqliteConnection } from "@orqenix/storage-sqlite";
import {
  ImmutableMemoryError,
  MemoryNotFoundError,
  type MemoryEntry,
  type MemoryId,
  type MemoryTier,
  type MemoryType,
} from "./contracts.js";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function encodeBase32(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 0x1f];
  return out;
}

export function newMemoryId(contentHash: ContentHash, scopeId: string): MemoryId {
  const seed = `${contentHash}|${scopeId}`;
  const digest = blake3Bytes(new TextEncoder().encode(seed)).slice(0, 20);
  return `mem:${encodeBase32(digest)}` as MemoryId;
}

interface Row {
  memory_id: string;
  tier: MemoryTier;
  type: MemoryType;
  content: string;
  content_hash: string;
  source_entry_ids: string;
  confidence: number;
  created_at: string;
  last_accessed_at: string;
  access_count: number;
  scope_id: string;
  metadata_json: string;
}

function toEntry(r: Row): MemoryEntry {
  return {
    id: r.memory_id as MemoryId,
    tier: r.tier,
    type: r.type,
    content: r.content,
    contentHash: r.content_hash,
    sourceEntryIds: JSON.parse(r.source_entry_ids) as string[],
    confidence: r.confidence,
    createdAt: r.created_at,
    lastAccessedAt: r.last_accessed_at,
    accessCount: r.access_count,
    scopeId: r.scope_id,
    metadata: JSON.parse(r.metadata_json) as Record<string, unknown>,
  };
}

interface StoreOpts {
  conn: SqliteConnection;
  scopeId: string;
  now?: () => string;
}

export class MemoryTierStore {
  private readonly conn: SqliteConnection;
  private readonly scopeId: string;
  private readonly now: () => string;

  constructor(opts: StoreOpts) {
    this.conn = opts.conn;
    this.scopeId = opts.scopeId;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  insert(
    input: Omit<MemoryEntry, "id" | "contentHash" | "createdAt" | "lastAccessedAt" | "accessCount">,
  ): MemoryEntry {
    const contentHash = hashString(`${input.type}\n${input.content}`);
    const id = newMemoryId(contentHash, input.scopeId);
    const now = this.now();

    const existing = this.conn
      .prepare<Row>(`SELECT * FROM memory_entries WHERE content_hash = ? AND scope_id = ?`)
      .get(contentHash, input.scopeId) as Row | undefined;
    if (existing) return toEntry(existing);

    this.conn
      .prepare(
        `INSERT INTO memory_entries
       (memory_id, tier, type, content, content_hash, source_entry_ids,
        confidence, created_at, last_accessed_at, access_count, scope_id, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        id,
        input.tier,
        input.type,
        input.content,
        contentHash,
        JSON.stringify(input.sourceEntryIds),
        input.confidence,
        now,
        now,
        input.scopeId,
        JSON.stringify(input.metadata ?? {}),
      );

    return {
      id,
      tier: input.tier,
      type: input.type,
      content: input.content,
      contentHash,
      sourceEntryIds: input.sourceEntryIds,
      confidence: input.confidence,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      scopeId: input.scopeId,
      metadata: input.metadata ?? {},
    };
  }

  getById(id: MemoryId): MemoryEntry {
    const r = this.conn.prepare<Row>(`SELECT * FROM memory_entries WHERE memory_id = ?`).get(id) as
      | Row
      | undefined;
    if (!r) throw new MemoryNotFoundError(id);
    return toEntry(r);
  }

  listByTier(tier: MemoryTier, opts: { limit?: number } = {}): MemoryEntry[] {
    const limit = Math.min(opts.limit ?? 100, 1000);
    const rows = this.conn
      .prepare<Row>(
        `SELECT * FROM memory_entries WHERE tier = ? AND scope_id = ? ORDER BY rowid ASC LIMIT ?`,
      )
      .all(tier, this.scopeId, limit) as Row[];
    return rows.map(toEntry);
  }

  listByType(type: MemoryType, opts: { limit?: number } = {}): MemoryEntry[] {
    const limit = Math.min(opts.limit ?? 100, 1000);
    const rows = this.conn
      .prepare<Row>(
        `SELECT * FROM memory_entries WHERE type = ? AND scope_id = ? ORDER BY rowid ASC LIMIT ?`,
      )
      .all(type, this.scopeId, limit) as Row[];
    return rows.map(toEntry);
  }

  recordAccess(id: MemoryId): void {
    const r = this.conn
      .prepare(
        `UPDATE memory_entries SET access_count = access_count + 1, last_accessed_at = ?
       WHERE memory_id = ?`,
      )
      .run(this.now(), id);
    if (r.changes === 0) throw new MemoryNotFoundError(id);
  }

  promote(id: MemoryId, newTier: MemoryTier): void {
    const current = this.getById(id);
    if (current.tier === "procedural") throw new ImmutableMemoryError(id);
    this.conn.prepare(`UPDATE memory_entries SET tier = ? WHERE memory_id = ?`).run(newTier, id);
  }

  listForPromotionScan(opts: { tier?: MemoryTier; limit?: number } = {}): MemoryEntry[] {
    const limit = Math.min(opts.limit ?? 500, 5000);
    const sql = opts.tier
      ? `SELECT * FROM memory_entries WHERE scope_id = ? AND tier = ? AND tier != 'procedural' ORDER BY rowid ASC LIMIT ?`
      : `SELECT * FROM memory_entries WHERE scope_id = ? AND tier != 'procedural' ORDER BY rowid ASC LIMIT ?`;
    const rows = opts.tier
      ? (this.conn.prepare<Row>(sql).all(this.scopeId, opts.tier, limit) as Row[])
      : (this.conn.prepare<Row>(sql).all(this.scopeId, limit) as Row[]);
    return rows.map(toEntry);
  }

  countByTier(): Record<MemoryTier, number> {
    const rows = this.conn
      .prepare<{
        tier: MemoryTier;
        c: number;
      }>(`SELECT tier, COUNT(*) as c FROM memory_entries WHERE scope_id = ? GROUP BY tier`)
      .all(this.scopeId) as Array<{ tier: MemoryTier; c: number }>;
    const result: Record<MemoryTier, number> = {
      working: 0,
      episodic: 0,
      semantic: 0,
      procedural: 0,
    };
    for (const r of rows) result[r.tier] = r.c;
    return result;
  }
}
