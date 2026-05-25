import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { CleanupPlan, CleanupResult, MemoryEntry, MemoryQuery, Tier } from "./types.js";

export class TierStore {
  private db: Database.Database | null = null;
  constructor(
    public readonly tier: Tier,
    private readonly dbPath: string,
  ) {}

  async open(): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.bootstrap();
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  private bootstrap(): void {
    if (!this.db) throw new Error("TierStore not opened");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        timestamp INTEGER NOT NULL,
        importance INTEGER NOT NULL DEFAULT 3,
        protected INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS mem_scope_idx ON memory(scope);
      CREATE INDEX IF NOT EXISTS mem_timestamp_idx ON memory(timestamp);
      CREATE INDEX IF NOT EXISTS mem_expires_idx ON memory(expires_at) WHERE expires_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS mem_importance_idx ON memory(importance);
    `);
  }

  async write(entry: Omit<MemoryEntry, "tier">): Promise<void> {
    this.required()
      .prepare(
        `INSERT OR REPLACE INTO memory
         (id, scope, type, content, metadata, timestamp, importance, protected, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.scope,
        entry.type,
        entry.content,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.timestamp,
        entry.importance,
        entry.protected ? 1 : 0,
        entry.expiresAt ?? null,
      );
  }

  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.scope) {
      where.push("scope = ?");
      params.push(q.scope);
    }
    if (q.type) {
      where.push("type = ?");
      params.push(q.type);
    }
    if (q.since) {
      where.push("timestamp >= ?");
      params.push(q.since);
    }
    if (q.until) {
      where.push("timestamp <= ?");
      params.push(q.until);
    }
    if (q.importanceMin) {
      where.push("importance >= ?");
      params.push(q.importanceMin);
    }
    if (q.text) {
      where.push("content LIKE ?");
      params.push(`%${q.text}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = q.limit ?? 100;
    const offset = q.offset ?? 0;
    const rows = this.required()
      .prepare(
        `SELECT * FROM memory ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Array<{
      id: string;
      scope: string;
      type: string;
      content: string;
      metadata: string | null;
      timestamp: number;
      importance: number;
      protected: number;
      expires_at: number | null;
    }>;
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      tier: this.tier,
      type: r.type,
      content: r.content,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      timestamp: r.timestamp,
      importance: r.importance,
      protected: r.protected === 1,
      expiresAt: r.expires_at ?? undefined,
    }));
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const row = this.required()
      .prepare("SELECT * FROM memory WHERE id = ?")
      .get(id) as
      | {
          id: string;
          scope: string;
          type: string;
          content: string;
          metadata: string | null;
          timestamp: number;
          importance: number;
          protected: number;
          expires_at: number | null;
        }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      scope: row.scope,
      tier: this.tier,
      type: row.type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamp: row.timestamp,
      importance: row.importance,
      protected: row.protected === 1,
      expiresAt: row.expires_at ?? undefined,
    };
  }

  async delete(id: string): Promise<void> {
    this.required().prepare("DELETE FROM memory WHERE id = ?").run(id);
  }

  async planCleanup(opts: {
    scope: string;
    olderThan: number;
    strategy: "lru" | "importance";
    keepProtected: boolean;
    keepCheckpoints: boolean;
  }): Promise<CleanupPlan> {
    const candidates = await this.query({ scope: opts.scope, limit: 100000 });
    const protectedEntries: MemoryEntry[] = [];
    const checkpointEntries: MemoryEntry[] = [];
    const removable: MemoryEntry[] = [];

    for (const e of candidates) {
      if (opts.keepProtected && e.protected) {
        protectedEntries.push(e);
        continue;
      }
      if (opts.keepCheckpoints && e.type === "checkpoint") {
        checkpointEntries.push(e);
        continue;
      }
      if (e.timestamp >= opts.olderThan) continue;
      removable.push(e);
    }

    let willRemove: MemoryEntry[];
    if (opts.strategy === "lru") {
      willRemove = removable.sort((a, b) => a.timestamp - b.timestamp);
    } else {
      willRemove = removable.sort((a, b) => a.importance - b.importance);
    }

    const totalBytes = willRemove.reduce(
      (sum, e) => sum + e.content.length + (e.metadata ? JSON.stringify(e.metadata).length : 0),
      0,
    );

    return {
      scope: opts.scope,
      tier: this.tier,
      candidates: removable.length,
      totalBytes,
      oldestTimestamp: willRemove[0]?.timestamp ?? 0,
      newestTimestamp: willRemove[willRemove.length - 1]?.timestamp ?? 0,
      protectedCount: protectedEntries.length,
      checkpointCount: checkpointEntries.length,
      willRemove,
      willPreserve: [...protectedEntries, ...checkpointEntries],
    };
  }

  async executeCleanup(plan: CleanupPlan): Promise<CleanupResult> {
    const start = Date.now();
    const tx = this.required().transaction((ids: string[]) => {
      const stmt = this.required().prepare("DELETE FROM memory WHERE id = ?");
      for (const id of ids) stmt.run(id);
    });
    tx(plan.willRemove.map((e) => e.id));
    return {
      scope: plan.scope,
      removed: plan.willRemove.length,
      bytesFreed: plan.totalBytes,
      durationMs: Date.now() - start,
    };
  }

  async sweepExpired(): Promise<number> {
    const r = this.required()
      .prepare("DELETE FROM memory WHERE expires_at IS NOT NULL AND expires_at < ?")
      .run(Date.now());
    return r.changes;
  }

  async count(scope?: string): Promise<number> {
    if (scope) {
      const r = this.required()
        .prepare("SELECT COUNT(*) AS c FROM memory WHERE scope = ?")
        .get(scope) as { c: number };
      return r.c;
    }
    const r = this.required().prepare("SELECT COUNT(*) AS c FROM memory").get() as {
      c: number;
    };
    return r.c;
  }

  async sizeBytes(scope?: string): Promise<number> {
    const params: unknown[] = [];
    let where = "";
    if (scope) {
      where = "WHERE scope = ?";
      params.push(scope);
    }
    const r = this.required()
      .prepare(`SELECT COALESCE(SUM(LENGTH(content)), 0) AS s FROM memory ${where}`)
      .get(...params) as { s: number };
    return r.s;
  }

  async vacuum(): Promise<void> {
    this.required().exec("VACUUM");
  }

  private required(): Database.Database {
    if (!this.db) throw new Error("TierStore not opened");
    return this.db;
  }
}
