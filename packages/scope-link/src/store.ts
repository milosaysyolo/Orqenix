// SPDX-License-Identifier: Apache-2.0
// @bc CS-020 Scope Link Store
// @gate G29.2, G29.3

import type { SqliteConnection } from "@orqenix/storage-sqlite";
import {
  ScopeLinkSchema,
  LinkAlreadyExistsError,
  LinkNotFoundError,
  LinkStateError,
  type LinkDirection,
  type LinkStatus,
  type ScopeLink,
} from "./contracts.js";

interface Row {
  local_scope_id: string;
  remote_scope_id: string;
  direction: LinkDirection;
  status: LinkStatus;
  display_name: string | null;
  capability_token_jti: string | null;
  created_at: string;
  last_synced_at: string | null;
  metadata_json: string;
}

function toLink(r: Row): ScopeLink {
  const link: ScopeLink = {
    localScopeId: r.local_scope_id,
    remoteScopeId: r.remote_scope_id,
    direction: r.direction,
    status: r.status,
    displayName: r.display_name ?? undefined,
    capabilityTokenJti: r.capability_token_jti ?? undefined,
    createdAt: r.created_at,
    lastSyncedAt: r.last_synced_at ?? undefined,
    metadata: JSON.parse(r.metadata_json) as Record<string, unknown>,
  };
  return link;
}

const LEGAL_TRANSITIONS: Record<LinkStatus, LinkStatus[]> = {
  pending: ["active", "revoked"],
  active: ["revoked"],
  revoked: [],
};

export interface CreateLinkInput {
  remoteScopeId: string;
  direction: LinkDirection;
  status?: LinkStatus;
  displayName?: string;
  capabilityTokenJti?: string;
  metadata?: Record<string, unknown>;
}

export interface ScopeLinkStoreOptions {
  conn: SqliteConnection;
  localScopeId: string;
  now?: () => string;
}

export class ScopeLinkStore {
  private readonly conn: SqliteConnection;
  private readonly localScopeId: string;
  private readonly now: () => string;

  constructor(opts: ScopeLinkStoreOptions) {
    this.conn = opts.conn;
    this.localScopeId = opts.localScopeId;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  create(input: CreateLinkInput): ScopeLink {
    const link = ScopeLinkSchema.parse({
      localScopeId: this.localScopeId,
      remoteScopeId: input.remoteScopeId,
      direction: input.direction,
      status: input.status ?? "pending",
      displayName: input.displayName,
      capabilityTokenJti: input.capabilityTokenJti,
      createdAt: this.now(),
      metadata: input.metadata ?? {},
    });
    try {
      this.conn
        .prepare(
          `INSERT INTO scope_links
         (local_scope_id, remote_scope_id, direction, status, display_name, capability_token_jti, created_at, last_synced_at, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .run(
          link.localScopeId,
          link.remoteScopeId,
          link.direction,
          link.status,
          link.displayName ?? null,
          link.capabilityTokenJti ?? null,
          link.createdAt,
          JSON.stringify(link.metadata),
        );
    } catch (e) {
      if (/UNIQUE constraint failed/i.test((e as Error).message)) {
        throw new LinkAlreadyExistsError(link.localScopeId, link.remoteScopeId, link.direction);
      }
      throw e;
    }
    return link;
  }

  tryGet(remoteScopeId: string, direction: LinkDirection): ScopeLink | null {
    const row = this.conn
      .prepare<Row>(
        `SELECT * FROM scope_links WHERE local_scope_id = ? AND remote_scope_id = ? AND direction = ?`,
      )
      .get(this.localScopeId, remoteScopeId, direction) as Row | undefined;
    return row ? toLink(row) : null;
  }

  get(remoteScopeId: string, direction: LinkDirection): ScopeLink {
    const l = this.tryGet(remoteScopeId, direction);
    if (!l) throw new LinkNotFoundError(this.localScopeId, remoteScopeId, direction);
    return l;
  }

  list(opts: { status?: LinkStatus; direction?: LinkDirection; limit?: number } = {}): ScopeLink[] {
    const limit = Math.min(opts.limit ?? 200, 5000);
    const where: string[] = ["local_scope_id = ?"];
    const params: unknown[] = [this.localScopeId];
    if (opts.status) {
      where.push("status = ?");
      params.push(opts.status);
    }
    if (opts.direction) {
      where.push("direction = ?");
      params.push(opts.direction);
    }
    const rows = this.conn
      .prepare<Row>(
        `SELECT * FROM scope_links WHERE ${where.join(" AND ")} ORDER BY rowid ASC LIMIT ?`,
      )
      .all(...params, limit) as Row[];
    return rows.map(toLink);
  }

  updateStatus(
    remoteScopeId: string,
    direction: LinkDirection,
    newStatus: LinkStatus,
    opts: { tokenJti?: string; touchSync?: boolean } = {},
  ): ScopeLink {
    const current = this.get(remoteScopeId, direction);
    const legal = LEGAL_TRANSITIONS[current.status];
    if (!legal.includes(newStatus)) {
      throw new LinkStateError(
        `illegal transition ${current.status} -> ${newStatus} (allowed: ${legal.join(", ") || "none"})`,
      );
    }
    const touchSync = opts.touchSync ?? newStatus === "active";
    const lastSync = touchSync ? this.now() : (current.lastSyncedAt ?? null);
    const jti = opts.tokenJti ?? current.capabilityTokenJti ?? null;
    this.conn
      .prepare(
        `UPDATE scope_links SET status = ?, last_synced_at = ?, capability_token_jti = ?
       WHERE local_scope_id = ? AND remote_scope_id = ? AND direction = ?`,
      )
      .run(newStatus, lastSync, jti, this.localScopeId, remoteScopeId, direction);
    return this.get(remoteScopeId, direction);
  }

  recordSync(remoteScopeId: string, direction: LinkDirection): ScopeLink {
    const current = this.get(remoteScopeId, direction);
    if (current.status !== "active") {
      throw new LinkStateError(`cannot record sync: link is ${current.status}, not active`);
    }
    this.conn
      .prepare(
        `UPDATE scope_links SET last_synced_at = ?
       WHERE local_scope_id = ? AND remote_scope_id = ? AND direction = ?`,
      )
      .run(this.now(), this.localScopeId, remoteScopeId, direction);
    return this.get(remoteScopeId, direction);
  }

  remove(remoteScopeId: string, direction: LinkDirection): boolean {
    const r = this.conn
      .prepare(
        `DELETE FROM scope_links WHERE local_scope_id = ? AND remote_scope_id = ? AND direction = ?`,
      )
      .run(this.localScopeId, remoteScopeId, direction);
    return r.changes > 0;
  }

  count(): number {
    const r = this.conn
      .prepare<{ c: number }>(`SELECT COUNT(*) as c FROM scope_links WHERE local_scope_id = ?`)
      .get(this.localScopeId) as { c: number };
    return r.c;
  }
}
