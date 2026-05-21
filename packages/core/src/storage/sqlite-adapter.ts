import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  Document,
  Filter,
  StorageAdapter,
  VectorResult,
} from "./adapter.js";

/**
 * SQLite-backed storage adapter implementing KV, document, and vector operations.
 * Uses better-sqlite3 with WAL mode. Vector methods are stubbed and throw
 * with a Phase 4 hint. sqlite-vec extension wiring will land in Phase 4.
 * See CHAPTER 4 + 9 of the spec.
 */
export class SqliteAdapter implements StorageAdapter {
  private db: Database.Database | null = null;
  constructor(private readonly dbPath: string, private readonly opts: { wal?: boolean } = {}) {}

  async open(): Promise<void> {
    await mkdir(dirname(this.dbPath), { recursive: true });
    this.db = new Database(this.dbPath);
    if (this.opts.wal !== false) {
      this.db.pragma("journal_mode = WAL");
    }
    this.db.pragma("foreign_keys = ON");
    this.bootstrap();
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  private bootstrap(): void {
    if (!this.db) throw new Error("SqliteAdapter not opened");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL,
        expires_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS docs (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS docs_collection_idx ON docs(collection);
    `);
    // stub: sqlite-vec extension load — wire in Phase 4 when CodeKB lands.
  }

  // ─────────── KV ───────────
  async get(key: string): Promise<unknown | null> {
    const row = this.required().prepare("SELECT v, expires_at FROM kv WHERE k = ?").get(key) as
      | { v: string; expires_at: number | null }
      | undefined;
    if (!row) return null;
    if (row.expires_at && row.expires_at < Date.now()) {
      await this.delete(key);
      return null;
    }
    return JSON.parse(row.v);
  }

  async set(key: string, value: unknown, ttlSec?: number): Promise<void> {
    const expiresAt = ttlSec ? Date.now() + ttlSec * 1000 : null;
    this.required()
      .prepare("INSERT OR REPLACE INTO kv (k, v, expires_at) VALUES (?, ?, ?)")
      .run(key, JSON.stringify(value), expiresAt);
  }

  async delete(key: string): Promise<void> {
    this.required().prepare("DELETE FROM kv WHERE k = ?").run(key);
  }

  // ─────────── Document ───────────
  async insert(collection: string, doc: Document): Promise<string> {
    const id = doc.id ?? crypto.randomUUID();
    this.required()
      .prepare("INSERT INTO docs (id, collection, json, created_at) VALUES (?, ?, ?, ?)")
      .run(id, collection, JSON.stringify({ ...doc, id }), Date.now());
    return id;
  }

  async query(collection: string, filter: Filter, limit = 100): Promise<Document[]> {
    const rows = this.required()
      .prepare("SELECT json FROM docs WHERE collection = ? ORDER BY created_at DESC LIMIT ?")
      .all(collection, limit) as Array<{ json: string }>;
    const docs = rows.map((r) => JSON.parse(r.json) as Document);
    // Naive filter; real impl will index in Phase 2.
    return docs.filter((d) =>
      Object.entries(filter).every(([k, v]) => (d as any)[k] === v),
    );
  }

  // ─────────── Vector ───────────
  async upsertVector(): Promise<void> {
    // stub: implement in Phase 4 with sqlite-vec.
    throw new Error("upsertVector: implement in Phase 4 (sqlite-vec wiring)");
  }

  async searchVectors(): Promise<VectorResult[]> {
    // stub: implement in Phase 4.
    throw new Error("searchVectors: implement in Phase 4 (sqlite-vec wiring)");
  }

  private required(): Database.Database {
    if (!this.db) throw new Error("SqliteAdapter not opened");
    return this.db;
  }
}
