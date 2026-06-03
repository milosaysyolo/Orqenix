import { blake3Bytes } from "@orqenix/core";
import type { SqliteConnection } from "@orqenix/storage-sqlite";
import { searchVec, insertVec } from "@orqenix/storage-sqlite";
import { hashString } from "@orqenix/storage-diff";
import {
  TokenVerifier,
  InsufficientCapabilityError,
  TokenExpiredError,
  TokenRevokedError,
  InvalidSignatureError,
  UnknownIssuerError,
} from "@orqenix/capability-tokens";
import {
  AppendChatEntryInputSchema,
  CreateSessionInputSchema,
  ChatWriteUnauthorizedError,
  HashChainBrokenError,
  SessionNotFoundError,
  type AppendChatEntryInput,
  type ChatEntry,
  type ChatEntryId,
  type ChatSession,
  type CreateSessionInput,
  type Role,
  type SessionId,
} from "./contracts.js";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
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

function newSessionId(scopeId: string, title: string, now: string, salt: number): SessionId {
  const seed = `${scopeId}|${title}|${now}|${salt}`;
  const digest = blake3Bytes(new TextEncoder().encode(seed)).slice(0, 20);
  return `sess:${encodeBase32(digest)}` as SessionId;
}

function newEntryId(sessionId: string, content: string, now: string, salt: number): ChatEntryId {
  const seed = `${sessionId}|${content.slice(0, 256)}|${now}|${salt}`;
  const digest = blake3Bytes(new TextEncoder().encode(seed)).slice(0, 20);
  return `ce:${encodeBase32(digest)}` as ChatEntryId;
}

interface ChatStoreOptions {
  conn: SqliteConnection;
  scopeId: string;
  verifier?: TokenVerifier;
  now?: () => string;
}

interface EntryRow {
  entry_id: string;
  session_id: string;
  role: Role;
  content: string;
  tokens: number | null;
  content_hash: string;
  prev_entry_hash: string | null;
  created_at: string;
  metadata_json: string;
}

interface SessionRow {
  session_id: string;
  scope_id: string;
  title: string;
  created_at: string;
  last_entry_at: string | null;
  entry_count: number;
}

function toEntry(row: EntryRow): ChatEntry {
  return {
    entryId: row.entry_id as ChatEntryId,
    sessionId: row.session_id as SessionId,
    role: row.role,
    content: row.content,
    tokens: row.tokens,
    contentHash: row.content_hash,
    prevEntryHash: row.prev_entry_hash,
    createdAt: row.created_at,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
  };
}

function toSession(row: SessionRow): ChatSession {
  return {
    sessionId: row.session_id as SessionId,
    scopeId: row.scope_id,
    title: row.title,
    createdAt: row.created_at,
    lastEntryAt: row.last_entry_at,
    entryCount: row.entry_count,
  };
}

export class ChatStore {
  private readonly conn: SqliteConnection;
  private readonly verifier?: TokenVerifier;
  private readonly now: () => string;
  private salt = 0;

  constructor(opts: ChatStoreOptions) {
    this.conn = opts.conn;
    this.verifier = opts.verifier;
    this.now = opts.now ?? (() => new Date().toISOString());
    void opts.scopeId;
  }

  createSession(input: CreateSessionInput): ChatSession {
    const parsed = CreateSessionInputSchema.parse(input);
    const now = this.now();
    const sessionId = newSessionId(parsed.scopeId, parsed.title, now, ++this.salt);
    this.conn
      .prepare(
        `INSERT INTO chat_sessions (session_id, scope_id, title, created_at, last_entry_at, entry_count)
       VALUES (?, ?, ?, ?, NULL, 0)`,
      )
      .run(sessionId, parsed.scopeId, parsed.title, now);
    return {
      sessionId,
      scopeId: parsed.scopeId,
      title: parsed.title,
      createdAt: now,
      lastEntryAt: null,
      entryCount: 0,
    };
  }

  getSession(sessionId: SessionId): ChatSession {
    const row = this.conn
      .prepare<SessionRow>(
        `SELECT session_id, scope_id, title, created_at, last_entry_at, entry_count
       FROM chat_sessions WHERE session_id = ?`,
      )
      .get(sessionId) as SessionRow | undefined;
    if (!row) throw new SessionNotFoundError(sessionId);
    return toSession(row);
  }

  private async authorize(encodedToken?: string): Promise<void> {
    if (!this.verifier) return;
    if (!encodedToken)
      throw new ChatWriteUnauthorizedError("no token provided to verifier-gated ChatStore");
    try {
      await this.verifier.verify(encodedToken, "write:kb-chat");
    } catch (e) {
      if (
        e instanceof InsufficientCapabilityError ||
        e instanceof TokenExpiredError ||
        e instanceof TokenRevokedError ||
        e instanceof InvalidSignatureError ||
        e instanceof UnknownIssuerError
      ) {
        throw new ChatWriteUnauthorizedError(`${e.code}: ${e.message}`);
      }
      throw e;
    }
  }

  async appendEntry(
    input: AppendChatEntryInput,
    opts: { encodedToken?: string } = {},
  ): Promise<ChatEntry> {
    await this.authorize(opts.encodedToken);
    const parsed = AppendChatEntryInputSchema.parse(input);
    this.getSession(parsed.sessionId as SessionId); // throws SessionNotFoundError if missing

    const now = this.now();
    const contentHash = hashString(`${parsed.role}\n${parsed.content}`);
    const entryId = newEntryId(parsed.sessionId, parsed.content, now, ++this.salt);

    const prevRow = this.conn
      .prepare<{ content_hash: string }>(
        `SELECT content_hash FROM chat_entries
       WHERE session_id = ? ORDER BY rowid DESC LIMIT 1`,
      )
      .get(parsed.sessionId) as { content_hash: string } | undefined;
    const prevEntryHash = prevRow?.content_hash ?? null;

    this.conn.transaction(() => {
      this.conn
        .prepare(
          `INSERT INTO chat_entries
         (entry_id, session_id, role, content, tokens, content_hash, prev_entry_hash, created_at, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          entryId,
          parsed.sessionId,
          parsed.role,
          parsed.content,
          parsed.tokens ?? null,
          contentHash,
          prevEntryHash,
          now,
          JSON.stringify(parsed.metadata),
        );
      this.conn
        .prepare(
          `UPDATE chat_sessions SET entry_count = entry_count + 1, last_entry_at = ?
         WHERE session_id = ?`,
        )
        .run(now, parsed.sessionId);
    });

    return {
      entryId,
      sessionId: parsed.sessionId as SessionId,
      role: parsed.role,
      content: parsed.content,
      tokens: parsed.tokens ?? null,
      contentHash,
      prevEntryHash,
      createdAt: now,
      metadata: parsed.metadata,
    };
  }

  listEntries(sessionId: SessionId, opts: { limit?: number } = {}): ChatEntry[] {
    const limit = Math.min(opts.limit ?? 100, 1000);
    const rows = this.conn
      .prepare<EntryRow>(
        `SELECT entry_id, session_id, role, content, tokens, content_hash, prev_entry_hash, created_at, metadata_json
       FROM chat_entries WHERE session_id = ?
        ORDER BY rowid ASC
       LIMIT ?`,
      )
      .all(sessionId, limit) as EntryRow[];
    return rows.map(toEntry);
  }

  async verifyHashChain(sessionId: SessionId): Promise<void> {
    const entries = this.listEntries(sessionId, { limit: 1_000_000 });
    let expectedPrev: string | null = null;
    for (const e of entries) {
      if (e.prevEntryHash !== expectedPrev) {
        throw new HashChainBrokenError(expectedPrev ?? "null", e.prevEntryHash ?? "null");
      }
      const computed = hashString(`${e.role}\n${e.content}`);
      if (computed !== e.contentHash) {
        throw new HashChainBrokenError(e.contentHash, computed);
      }
      expectedPrev = e.contentHash;
    }
  }

  indexEmbedding(entryId: ChatEntryId, embedding: Float32Array): void {
    const row = this.conn
      .prepare<{ rowid: number }>(`SELECT rowid FROM chat_entries WHERE entry_id = ?`)
      .get(entryId) as { rowid: number } | undefined;
    if (!row) throw new SessionNotFoundError(entryId);
    insertVec(this.conn, "chat_embeddings", row.rowid, embedding);
  }

  searchByEmbedding(query: Float32Array, k: number): Array<{ entry: ChatEntry; distance: number }> {
    const hits = searchVec(this.conn, "chat_embeddings", query, k);
    const out: Array<{ entry: ChatEntry; distance: number }> = [];
    for (const h of hits) {
      const row = this.conn
        .prepare<EntryRow>(
          `SELECT entry_id, session_id, role, content, tokens, content_hash, prev_entry_hash, created_at, metadata_json
         FROM chat_entries WHERE rowid = ?`,
        )
        .get(h.rowid) as EntryRow | undefined;
      if (row) out.push({ entry: toEntry(row), distance: h.distance });
    }
    return out;
  }
}
