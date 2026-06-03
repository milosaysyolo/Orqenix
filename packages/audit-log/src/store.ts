// SPDX-License-Identifier: Apache-2.0
// @bc CS-024 Audit Log Store
// @gate G18.2, G18.3

import { canonicalJson } from '@orqenix/core';
import { hashString, type ContentHash } from '@orqenix/storage-diff';
import type { SqliteConnection } from '@orqenix/storage-sqlite';
import {
  AppendAuditInputSchema, AuditEntrySchema,
  AuditChainBrokenError, AuditEntryInvalidError,
  type AppendAuditInput, type AuditEntry, type AuditEventKind,
} from './contracts.js';

interface Row {
  rowid: number;
  scope_id: string;
  actor_scope_id: string;
  event_kind: AuditEventKind;
  payload_json: string;
  prev_hash: string | null;
  content_hash: string;
  created_at: string;
}

function toEntry(r: Row): AuditEntry {
  return {
    rowid: r.rowid,
    scopeId: r.scope_id,
    actorScopeId: r.actor_scope_id,
    eventKind: r.event_kind,
    payload: JSON.parse(r.payload_json) as Record<string, unknown>,
    prevHash: r.prev_hash,
    contentHash: r.content_hash,
    createdAt: r.created_at,
  };
}

function computeContentHash(args: {
  scopeId: string; actorScopeId: string; eventKind: string;
  payload: Record<string, unknown>; prevHash: string | null; createdAt: string;
}): ContentHash {
  return hashString(canonicalJson(args)) as ContentHash;
}

export interface AuditLogStoreOptions {
  conn: SqliteConnection;
  scopeId: string;
  now?: () => string;
}

export class AuditLogStore {
  private readonly conn: SqliteConnection;
  private readonly scopeId: string;
  private readonly now: () => string;

  constructor(opts: AuditLogStoreOptions) {
    this.conn = opts.conn;
    this.scopeId = opts.scopeId;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  private getLatestHashForScope(): string | null {
    const row = this.conn.prepare<{ content_hash: string }>(
      `SELECT content_hash FROM audit_log_entries WHERE scope_id = ? ORDER BY rowid DESC LIMIT 1`,
    ).get(this.scopeId) as { content_hash: string } | undefined;
    return row?.content_hash ?? null;
  }

  append(rawInput: AppendAuditInput): AuditEntry {
    const input = AppendAuditInputSchema.parse(rawInput);
    const createdAt = this.now();
    const prevHash = this.getLatestHashForScope();
    const contentHash = computeContentHash({
      scopeId: this.scopeId,
      actorScopeId: input.actorScopeId,
      eventKind: input.eventKind,
      payload: input.payload,
      prevHash,
      createdAt,
    });

    const res = this.conn.prepare(
      `INSERT INTO audit_log_entries
       (scope_id, actor_scope_id, event_kind, payload_json, prev_hash, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      this.scopeId, input.actorScopeId, input.eventKind,
      JSON.stringify(input.payload), prevHash, contentHash, createdAt,
    );

    const entry: AuditEntry = {
      rowid: Number(res.lastInsertRowid),
      scopeId: this.scopeId,
      actorScopeId: input.actorScopeId,
      eventKind: input.eventKind,
      payload: input.payload,
      prevHash, contentHash, createdAt,
    };
    AuditEntrySchema.parse(entry);
    return entry;
  }

  list(opts: { kind?: AuditEventKind; limit?: number } = {}): AuditEntry[] {
    const limit = Math.min(opts.limit ?? 500, 10_000);
    const where: string[] = ['scope_id = ?'];
    const params: unknown[] = [this.scopeId];
    if (opts.kind) { where.push('event_kind = ?'); params.push(opts.kind); }
    const rows = this.conn.prepare<Row>(
      `SELECT rowid, scope_id, actor_scope_id, event_kind, payload_json, prev_hash, content_hash, created_at
       FROM audit_log_entries WHERE ${where.join(' AND ')} ORDER BY rowid ASC LIMIT ?`,
    ).all(...params, limit) as Row[];
    return rows.map(toEntry);
  }

  count(): number {
    const r = this.conn.prepare<{ c: number }>(
      `SELECT COUNT(*) as c FROM audit_log_entries WHERE scope_id = ?`,
    ).get(this.scopeId) as { c: number };
    return r.c;
  }

  getByContentHash(hash: string): AuditEntry | null {
    const row = this.conn.prepare<Row>(
      `SELECT rowid, scope_id, actor_scope_id, event_kind, payload_json, prev_hash, content_hash, created_at
       FROM audit_log_entries WHERE content_hash = ? AND scope_id = ?`,
    ).get(hash, this.scopeId) as Row | undefined;
    return row ? toEntry(row) : null;
  }

  verifyChain(): { ok: true; entriesChecked: number } | never {
    const entries = this.list({ limit: 10_000_000 });
    let expectedPrev: string | null = null;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      if (e.prevHash !== expectedPrev) {
        throw new AuditChainBrokenError(
          `entry ${e.rowid}: prevHash mismatch (expected ${expectedPrev ?? 'null'}, got ${e.prevHash ?? 'null'})`,
        );
      }
      const recomputed = computeContentHash({
        scopeId: e.scopeId,
        actorScopeId: e.actorScopeId,
        eventKind: e.eventKind,
        payload: e.payload,
        prevHash: e.prevHash,
        createdAt: e.createdAt,
      });
      if (recomputed !== e.contentHash) {
        throw new AuditChainBrokenError(
          `entry ${e.rowid}: contentHash mismatch (recomputed ${recomputed.slice(0, 12)}..., stored ${e.contentHash.slice(0, 12)}...)`,
        );
      }
      expectedPrev = e.contentHash;
    }
    return { ok: true, entriesChecked: entries.length };
  }

  // Throws AuditEntryInvalidError if the entry exists but its hash does not match recomputed.
  verifyEntry(rowid: number): AuditEntry {
    const row = this.conn.prepare<Row>(
      `SELECT rowid, scope_id, actor_scope_id, event_kind, payload_json, prev_hash, content_hash, created_at
       FROM audit_log_entries WHERE rowid = ? AND scope_id = ?`,
    ).get(rowid, this.scopeId) as Row | undefined;
    if (!row) throw new AuditEntryInvalidError(`entry ${rowid} not found`);
    const e = toEntry(row);
    const recomputed = computeContentHash({
      scopeId: e.scopeId, actorScopeId: e.actorScopeId,
      eventKind: e.eventKind, payload: e.payload,
      prevHash: e.prevHash, createdAt: e.createdAt,
    });
    if (recomputed !== e.contentHash) {
      throw new AuditEntryInvalidError(`entry ${rowid} hash mismatch`);
    }
    return e;
  }
}
