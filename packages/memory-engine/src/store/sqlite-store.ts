// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , SQLite store
//
// better-sqlite3 connection with WAL + foreign_keys + busy_timeout. Provides
// the low-level CRUD for memory entries. Wires the actual storage that all
// D8.α stubs referenced.

import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { BlobStore } from "./blob-store";
import type { KbKind, MemoryEntry, WriteEntryInput, Tier, ProtectionFlags } from "./types";

const KB_TABLE: Record<KbKind, string> = {
  chat: "chat_entries",
  code: "code_entries",
  decision: "decision_entries",
  lesson: "lesson_entries",
};

/** Content larger than this is stored in the blob table; smaller stays inline */
const INLINE_CONTENT_MAX = 4096;

export class SqliteStore {
  readonly db: DB;
  readonly blobs: BlobStore;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.pragma("synchronous = NORMAL");
    this.blobs = new BlobStore(this.db);
  }

  /** Writes a memory entry. Large content goes to blob store. */
  write(input: WriteEntryInput): MemoryEntry {
    const id = ulid();
    const now = new Date().toISOString();
    const tier = input.tier ?? "T1";

    // Decide inline vs blob storage
    let inlineContent: string | null = input.content;
    let hash: string;
    if (input.content.length > INLINE_CONTENT_MAX) {
      hash = this.blobs.put(input.content);
      inlineContent = null;
    } else {
      const bytes = new TextEncoder().encode(input.content);
      hash = this.blobs.computeHash(bytes);
    }

    const table = KB_TABLE[input.kb];
    const embeddingBuf = input.embedding
      ? Buffer.from(input.embedding.buffer, input.embedding.byteOffset, input.embedding.byteLength)
      : null;

    this.db
      .prepare(
        `INSERT INTO ${table} (
          id, hash, tier, content, embedding,
          project_id, branch_id, session_id, memory_level,
          protection_flags, cloned_from_branch_id,
          promoted_from_session_id, promoted_from_branch_id,
          created_at, updated_at
        ) VALUES (
          @id, @hash, @tier, @content, @embedding,
          @projectId, @branchId, @sessionId, @memoryLevel,
          @protectionFlags, @clonedFrom,
          @promotedSession, @promotedBranch,
          @createdAt, @updatedAt
        )`,
      )
      .run({
        id,
        hash,
        tier,
        content: inlineContent,
        embedding: embeddingBuf,
        projectId: input.project_id,
        branchId: input.branch_id,
        sessionId: input.session_id ?? null,
        memoryLevel: input.memory_level,
        protectionFlags: input.protection_flags ? JSON.stringify(input.protection_flags) : null,
        clonedFrom: input.cloned_from_branch_id ?? null,
        promotedSession: input.promoted_from_session_id ?? null,
        promotedBranch: input.promoted_from_branch_id ?? null,
        createdAt: now,
        updatedAt: now,
      });

    return {
      id,
      hash,
      kb: input.kb,
      tier,
      content: inlineContent,
      embedding: input.embedding ?? null,
      project_id: input.project_id,
      branch_id: input.branch_id,
      session_id: input.session_id ?? null,
      memory_level: input.memory_level,
      protection_flags: input.protection_flags ?? null,
      cloned_from_branch_id: input.cloned_from_branch_id ?? null,
      promoted_from_session_id: input.promoted_from_session_id ?? null,
      promoted_from_branch_id: input.promoted_from_branch_id ?? null,
      created_at: now,
      updated_at: now,
    };
  }

  /** Fetches full content for an entry by ID (resolves blob if needed). */
  fetchContent(kb: KbKind, id: string): string | null {
    const table = KB_TABLE[kb];
    const row = this.db.prepare(`SELECT content, hash FROM ${table} WHERE id = ?`).get(id) as
      | { content: string | null; hash: string }
      | undefined;
    if (!row) return null;
    if (row.content !== null) return row.content;
    // Content in blob store
    return this.blobs.get(row.hash);
  }

  /** Returns a single entry by ID */
  getEntry(kb: KbKind, id: string): MemoryEntry | null {
    const table = KB_TABLE[kb];
    const row = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return this.rowToEntry(row, kb);
  }

  /** Closes the database connection */
  close(): void {
    this.db.close();
  }

  private rowToEntry(row: Record<string, unknown>, kb: KbKind): MemoryEntry {
    let embedding: Float32Array | null = null;
    if (row.embedding instanceof Buffer) {
      embedding = new Float32Array(
        row.embedding.buffer,
        row.embedding.byteOffset,
        row.embedding.byteLength / 4,
      );
    }
    let protectionFlags: ProtectionFlags | null = null;
    if (typeof row.protection_flags === "string" && row.protection_flags.length > 0) {
      try {
        protectionFlags = JSON.parse(row.protection_flags) as ProtectionFlags;
      } catch {
        protectionFlags = null;
      }
    }
    return {
      id: row.id as string,
      hash: row.hash as string,
      kb,
      tier: row.tier as Tier,
      content: (row.content as string | null) ?? null,
      embedding,
      project_id: row.project_id as string,
      branch_id: (row.branch_id as string) ?? "",
      session_id: (row.session_id as string | null) ?? null,
      memory_level: (row.memory_level as MemoryEntry["memory_level"]) ?? "project",
      protection_flags: protectionFlags,
      cloned_from_branch_id: (row.cloned_from_branch_id as string | null) ?? null,
      promoted_from_session_id: (row.promoted_from_session_id as string | null) ?? null,
      promoted_from_branch_id: (row.promoted_from_branch_id as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: (row.updated_at as string) ?? (row.created_at as string),
    };
  }
}

// Minimal ULID generator inline (avoids extra dependency)
import { ulid } from "./ulid";
export { ulid } from "./ulid";
