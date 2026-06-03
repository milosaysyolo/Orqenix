import { stat, readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { SqliteConnection } from '@orqenix/storage-sqlite';
import { hashBytes, type ContentHash } from '@orqenix/storage-diff';
import type { FileEvent } from '@orqenix/file-watcher';
import { IndexEntrySchema, type IndexEntry, type ReindexStats } from './contracts.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_IGNORE_RX = /(^|\/)(\.git|node_modules|dist|\.orqenix\/identity\.key|\.orqenix\/gate-reports)(\/|$)/;

function toPosix(p: string): string { return sep === '/' ? p : p.split(sep).join('/'); }

export class ReindexIndexer {
  constructor(private readonly conn: SqliteConnection) {}

  upsert(entry: IndexEntry): void {
    const parsed = IndexEntrySchema.parse(entry);
    this.conn.prepare(
      `INSERT INTO reindex_entries (rel_path, scope_id, content_hash, size_bytes, modified_at, indexed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(scope_id, rel_path) DO UPDATE SET
         content_hash = excluded.content_hash,
         size_bytes   = excluded.size_bytes,
         modified_at  = excluded.modified_at,
         indexed_at   = excluded.indexed_at`,
    ).run(parsed.relPath, parsed.scopeId, parsed.contentHash, parsed.sizeBytes, parsed.modifiedAt, new Date().toISOString());
  }

  remove(scopeId: string, relPath: string): boolean {
    const r = this.conn.prepare(`DELETE FROM reindex_entries WHERE scope_id = ? AND rel_path = ?`).run(scopeId, relPath);
    return r.changes > 0;
  }

  get(scopeId: string, relPath: string): IndexEntry | null {
    const row = this.conn.prepare<{
      rel_path: string; scope_id: string; content_hash: string;
      size_bytes: number; modified_at: string;
    }>(
      `SELECT rel_path, scope_id, content_hash, size_bytes, modified_at
       FROM reindex_entries WHERE scope_id = ? AND rel_path = ?`,
    ).get(scopeId, relPath) as { rel_path: string; scope_id: string; content_hash: string; size_bytes: number; modified_at: string } | undefined;
    if (!row) return null;
    return {
      relPath: row.rel_path, scopeId: row.scope_id,
      contentHash: row.content_hash, sizeBytes: row.size_bytes, modifiedAt: row.modified_at,
    };
  }

  list(scopeId: string): IndexEntry[] {
    const rows = this.conn.prepare<{
      rel_path: string; scope_id: string; content_hash: string;
      size_bytes: number; modified_at: string;
    }>(
      `SELECT rel_path, scope_id, content_hash, size_bytes, modified_at
       FROM reindex_entries WHERE scope_id = ?
       ORDER BY rel_path ASC`,
    ).all(scopeId) as Array<{ rel_path: string; scope_id: string; content_hash: string; size_bytes: number; modified_at: string }>;
    return rows.map((r) => ({
      relPath: r.rel_path, scopeId: r.scope_id,
      contentHash: r.content_hash, sizeBytes: r.size_bytes, modifiedAt: r.modified_at,
    }));
  }

  count(scopeId: string): number {
    const r = this.conn.prepare<{ c: number }>(`SELECT COUNT(*) as c FROM reindex_entries WHERE scope_id = ?`).get(scopeId) as { c: number };
    return r.c;
  }
}

interface ReindexerOptions {
  indexer: ReindexIndexer;
  scopeId: string;
  rootDir: string;
}

export class Reindexer {
  private readonly indexer: ReindexIndexer;
  private readonly scopeId: string;
  private readonly rootDir: string;

  constructor(opts: ReindexerOptions) {
    this.indexer = opts.indexer;
    this.scopeId = opts.scopeId;
    this.rootDir = opts.rootDir;
  }

  private isIgnored(rel: string): boolean {
    return DEFAULT_IGNORE_RX.test(rel);
  }

  async scanFull(): Promise<ReindexStats> {
    const started = Date.now();
    const stats: ReindexStats = {
      filesScanned: 0, filesAdded: 0, filesUpdated: 0,
      filesRemoved: 0, filesUnchanged: 0, durationMs: 0,
    };
    const existing = new Map<string, IndexEntry>();
    for (const e of this.indexer.list(this.scopeId)) existing.set(e.relPath, e);

    const visited = new Set<string>();
    const walk = async (absDir: string): Promise<void> => {
      let entries;
      try { entries = await readdir(absDir, { withFileTypes: true }); }
      catch { return; }
      for (const ent of entries) {
        const abs = join(absDir, ent.name);
        const rel = toPosix(relative(this.rootDir, abs));
        if (this.isIgnored(rel)) continue;
        if (ent.isSymbolicLink()) continue;
        if (ent.isDirectory()) { await walk(abs); continue; }
        if (!ent.isFile()) continue;
        let s;
        try { s = await stat(abs); } catch { continue; }
        if (s.size > MAX_FILE_BYTES) continue;
        stats.filesScanned++;
        let bytes: Buffer;
        try { bytes = await readFile(abs); } catch { continue; }
        const contentHash = hashBytes(bytes) as ContentHash;
        const entry: IndexEntry = {
          relPath: rel, scopeId: this.scopeId,
          contentHash, sizeBytes: s.size, modifiedAt: s.mtime.toISOString(),
        };
        const prior = existing.get(rel);
        visited.add(rel);
        if (!prior) { this.indexer.upsert(entry); stats.filesAdded++; }
        else if (prior.contentHash !== contentHash) { this.indexer.upsert(entry); stats.filesUpdated++; }
        else { stats.filesUnchanged++; }
      }
    };
    await walk(this.rootDir);

    for (const rel of existing.keys()) {
      if (!visited.has(rel)) {
        this.indexer.remove(this.scopeId, rel);
        stats.filesRemoved++;
      }
    }
    stats.durationMs = Date.now() - started;
    return stats;
  }

  async applyEvents(events: FileEvent[]): Promise<ReindexStats> {
    const started = Date.now();
    const stats: ReindexStats = {
      filesScanned: 0, filesAdded: 0, filesUpdated: 0,
      filesRemoved: 0, filesUnchanged: 0, durationMs: 0,
    };
    for (const e of events) {
      if (this.isIgnored(e.relPath)) continue;
      stats.filesScanned++;
      if (e.kind === 'unlink') {
        if (this.indexer.remove(this.scopeId, e.relPath)) stats.filesRemoved++;
        continue;
      }
      let s;
      try { s = await stat(e.path); }
      catch { stats.filesRemoved += this.indexer.remove(this.scopeId, e.relPath) ? 1 : 0; continue; }
      if (s.size > MAX_FILE_BYTES) continue;
      let bytes: Buffer;
      try { bytes = await readFile(e.path); } catch { continue; }
      const contentHash = hashBytes(bytes) as ContentHash;
      const prior = this.indexer.get(this.scopeId, e.relPath);
      const entry: IndexEntry = {
        relPath: e.relPath, scopeId: this.scopeId,
        contentHash, sizeBytes: s.size, modifiedAt: s.mtime.toISOString(),
      };
      if (!prior) { this.indexer.upsert(entry); stats.filesAdded++; }
      else if (prior.contentHash !== contentHash) { this.indexer.upsert(entry); stats.filesUpdated++; }
      else { stats.filesUnchanged++; }
    }
    stats.durationMs = Date.now() - started;
    return stats;
  }
}
