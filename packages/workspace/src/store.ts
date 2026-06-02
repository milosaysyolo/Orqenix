// SPDX-License-Identifier: Apache-2.0
// @bc CS-022 Workspace Store
// @gate G31.2, G31.3, G31.4

import { blake3Bytes } from '@orqenix/core';
import type { SqliteConnection } from '@orqenix/storage-sqlite';
import {
  WorkspaceSchema, MembershipSchema,
  WorkspaceAlreadyExistsError, WorkspaceNotFoundError,
  MembershipAlreadyExistsError, MembershipNotFoundError, OwnerRemovalError,
  type Membership, type MembershipRole, type Workspace, type WorkspaceId,
} from './contracts.js';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function encodeBase32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 0x1f]; bits -= 5; }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 0x1f];
  return out;
}

function deriveWorkspaceId(ownerScopeId: string, name: string, now: string, salt: number): WorkspaceId {
  const seed = `${ownerScopeId}|${name}|${now}|${salt}`;
  const digest = blake3Bytes(new TextEncoder().encode(seed)).slice(0, 20);
  return `ws:${encodeBase32(digest)}` as WorkspaceId;
}

interface WorkspaceRow {
  id: string; name: string; owner_scope_id: string;
  description: string | null; created_at: string; metadata_json: string;
}
interface MembershipRow {
  workspace_id: string; scope_id: string; role: MembershipRole; joined_at: string;
}

function toWorkspace(r: WorkspaceRow): Workspace {
  return {
    id: r.id as WorkspaceId,
    name: r.name,
    ownerScopeId: r.owner_scope_id,
    description: r.description ?? undefined,
    createdAt: r.created_at,
    metadata: JSON.parse(r.metadata_json) as Record<string, unknown>,
  };
}

function toMembership(r: MembershipRow): Membership {
  return {
    workspaceId: r.workspace_id as WorkspaceId,
    scopeId: r.scope_id,
    role: r.role,
    joinedAt: r.joined_at,
  };
}

export interface CreateWorkspaceInput {
  name: string;
  ownerScopeId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export class WorkspaceStore {
  private readonly conn: SqliteConnection;
  private readonly now: () => string;
  private salt = 0;

  constructor(opts: { conn: SqliteConnection; now?: () => string }) {
    this.conn = opts.conn;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  create(input: CreateWorkspaceInput): Workspace {
    const now = this.now();
    const id = deriveWorkspaceId(input.ownerScopeId, input.name, now, ++this.salt);
    const ws = WorkspaceSchema.parse({
      id, name: input.name, ownerScopeId: input.ownerScopeId,
      description: input.description, createdAt: now,
      metadata: input.metadata ?? {},
    });

    try {
      this.conn.transaction(() => {
        this.conn.prepare(
          `INSERT INTO workspaces (id, name, owner_scope_id, description, created_at, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(ws.id, ws.name, ws.ownerScopeId, ws.description ?? null, ws.createdAt, JSON.stringify(ws.metadata));
        this.conn.prepare(
          `INSERT INTO workspace_memberships (workspace_id, scope_id, role, joined_at)
           VALUES (?, ?, 'owner', ?)`,
        ).run(ws.id, ws.ownerScopeId, ws.createdAt);
      });
    } catch (e) {
      if (/UNIQUE constraint failed/i.test((e as Error).message)) {
        throw new WorkspaceAlreadyExistsError(ws.id);
      }
      throw e;
    }
    return ws;
  }

  get(id: WorkspaceId): Workspace {
    const row = this.conn.prepare<WorkspaceRow>(`SELECT * FROM workspaces WHERE id = ?`).get(id) as WorkspaceRow | undefined;
    if (!row) throw new WorkspaceNotFoundError(id);
    return toWorkspace(row);
  }

  listForScope(scopeId: string): Workspace[] {
    const rows = this.conn.prepare<WorkspaceRow>(
      `SELECT w.* FROM workspaces w
       JOIN workspace_memberships m ON m.workspace_id = w.id
       WHERE m.scope_id = ?
       ORDER BY w.rowid ASC`,
    ).all(scopeId) as WorkspaceRow[];
    return rows.map(toWorkspace);
  }

  delete(id: WorkspaceId): boolean {
    const r = this.conn.prepare(`DELETE FROM workspaces WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  addMember(workspaceId: WorkspaceId, scopeId: string, role: MembershipRole): Membership {
    this.get(workspaceId); // ensure workspace exists
    const joinedAt = this.now();
    const m = MembershipSchema.parse({ workspaceId, scopeId, role, joinedAt });
    try {
      this.conn.prepare(
        `INSERT INTO workspace_memberships (workspace_id, scope_id, role, joined_at)
         VALUES (?, ?, ?, ?)`,
      ).run(m.workspaceId, m.scopeId, m.role, m.joinedAt);
    } catch (e) {
      if (/UNIQUE constraint failed/i.test((e as Error).message)) {
        throw new MembershipAlreadyExistsError(workspaceId, scopeId);
      }
      throw e;
    }
    return m;
  }

  removeMember(workspaceId: WorkspaceId, scopeId: string): boolean {
    const ws = this.get(workspaceId);
    if (ws.ownerScopeId === scopeId) throw new OwnerRemovalError();
    const r = this.conn.prepare(
      `DELETE FROM workspace_memberships WHERE workspace_id = ? AND scope_id = ?`,
    ).run(workspaceId, scopeId);
    return r.changes > 0;
  }

  getMember(workspaceId: WorkspaceId, scopeId: string): Membership {
    const row = this.conn.prepare<MembershipRow>(
      `SELECT * FROM workspace_memberships WHERE workspace_id = ? AND scope_id = ?`,
    ).get(workspaceId, scopeId) as MembershipRow | undefined;
    if (!row) throw new MembershipNotFoundError(workspaceId, scopeId);
    return toMembership(row);
  }

  changeRole(workspaceId: WorkspaceId, scopeId: string, newRole: MembershipRole): Membership {
    const ws = this.get(workspaceId);
    const current = this.getMember(workspaceId, scopeId);
    if (current.role === 'owner' && newRole !== 'owner') {
      throw new OwnerRemovalError(); // cannot demote owner directly
    }
    if (newRole === 'owner' && ws.ownerScopeId !== scopeId) {
      throw new OwnerRemovalError(); // cannot promote to owner without transferOwnership
    }
    this.conn.prepare(
      `UPDATE workspace_memberships SET role = ? WHERE workspace_id = ? AND scope_id = ?`,
    ).run(newRole, workspaceId, scopeId);
    return this.getMember(workspaceId, scopeId);
  }

  listMembers(workspaceId: WorkspaceId): Membership[] {
    this.get(workspaceId);
    const rows = this.conn.prepare<MembershipRow>(
      `SELECT * FROM workspace_memberships WHERE workspace_id = ? ORDER BY rowid ASC`,
    ).all(workspaceId) as MembershipRow[];
    return rows.map(toMembership);
  }

  transferOwnership(workspaceId: WorkspaceId, newOwnerScopeId: string): Workspace {
    const ws = this.get(workspaceId);
    if (ws.ownerScopeId === newOwnerScopeId) return ws;
    const newOwnerMember = this.conn.prepare<MembershipRow>(
      `SELECT * FROM workspace_memberships WHERE workspace_id = ? AND scope_id = ?`,
    ).get(workspaceId, newOwnerScopeId) as MembershipRow | undefined;
    if (!newOwnerMember) throw new MembershipNotFoundError(workspaceId, newOwnerScopeId);

    this.conn.transaction(() => {
      this.conn.prepare(
        `UPDATE workspace_memberships SET role = 'contributor' WHERE workspace_id = ? AND scope_id = ?`,
      ).run(workspaceId, ws.ownerScopeId);
      this.conn.prepare(
        `UPDATE workspace_memberships SET role = 'owner' WHERE workspace_id = ? AND scope_id = ?`,
      ).run(workspaceId, newOwnerScopeId);
      this.conn.prepare(`UPDATE workspaces SET owner_scope_id = ? WHERE id = ?`).run(newOwnerScopeId, workspaceId);
    });
    return this.get(workspaceId);
  }
}
