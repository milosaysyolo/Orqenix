// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Audit chain writer
//
// Single BLAKE3 hash chain per project (INV-3). Extends Phase 7 D7.13 chain
// shape with branch_id/session_id/parent_session_id metadata. The chain remains
// verifiable by the D7.5 AuditChainVerifier Web Worker without modification.

import type { Database } from 'better-sqlite3';
import { blake3 } from '@noble/hashes/blake3';
import { ulid } from '../store/ulid';
import type {
  AuditEntry,
  AppendAuditInput,
  ChainVerifyResult,
  MemoryAuditKind,
} from './types';

const ZERO_HASH = '0'.repeat(64);

/**
 * Writes + verifies the single per-project BLAKE3 audit chain.
 *
 * Hash computation (matches D7.13 canonical form, enriched with hierarchy):
 *   this_hash = BLAKE3(prev_hash || canonical(entry without this_hash))
 */
export class AuditChainWriter {
  constructor(private readonly db: Database) {}

  /** Appends an entry to the project's audit chain. Returns the entry. */
  append(input: AppendAuditInput): AuditEntry {
    const id = ulid();
    const ts = new Date().toISOString();

    // Get prev_hash (last this_hash for this project, or ZERO if first)
    const last = this.db
      .prepare(
        'SELECT this_hash FROM audit_entries WHERE project_id = ? ORDER BY seq DESC LIMIT 1'
      )
      .get(input.project_id) as { this_hash: string } | undefined;
    const prevHash = last?.this_hash ?? ZERO_HASH;

    // Build canonical form (without this_hash) for hashing
    const canonical = this.canonicalize({
      id,
      ts,
      project_id: input.project_id,
      branch_id: input.branch_id ?? null,
      session_id: input.session_id ?? null,
      parent_session_id: input.parent_session_id ?? null,
      kind: input.kind,
      actor: input.actor,
      target: input.target ?? null,
      payload: input.payload,
      prev_hash: prevHash,
    });

    const thisHash = this.hash(prevHash + canonical);

    // Insert (seq is AUTOINCREMENT)
    const info = this.db
      .prepare(
        `INSERT INTO audit_entries (
          id, ts, project_id, branch_id, session_id, parent_session_id,
          kind, actor, target, payload, prev_hash, this_hash, cloud_sig
        ) VALUES (
          @id, @ts, @projectId, @branchId, @sessionId, @parentSessionId,
          @kind, @actor, @target, @payload, @prevHash, @thisHash, NULL
        )`
      )
      .run({
        id,
        ts,
        projectId: input.project_id,
        branchId: input.branch_id ?? null,
        sessionId: input.session_id ?? null,
        parentSessionId: input.parent_session_id ?? null,
        kind: input.kind,
        actor: JSON.stringify(input.actor),
        target: input.target ? JSON.stringify(input.target) : null,
        payload: JSON.stringify(input.payload),
        prevHash,
        thisHash,
      });

    return {
      seq: Number(info.lastInsertRowid),
      id,
      ts,
      project_id: input.project_id,
      branch_id: input.branch_id ?? null,
      session_id: input.session_id ?? null,
      parent_session_id: input.parent_session_id ?? null,
      kind: input.kind,
      actor: input.actor,
      target: input.target ?? null,
      payload: input.payload,
      prev_hash: prevHash,
      this_hash: thisHash,
      cloud_sig: null,
    };
  }

  /**
   * Verifies the chain integrity for a project.
   *
   * Walks entries in seq order, recomputes each this_hash, confirms linkage.
   * Returns first mismatch seq if corrupted.
   */
  verify(projectId: string): ChainVerifyResult {
    const rows = this.db
      .prepare(
        `SELECT seq, id, ts, project_id, branch_id, session_id, parent_session_id,
                kind, actor, target, payload, prev_hash, this_hash
         FROM audit_entries WHERE project_id = ? ORDER BY seq ASC`
      )
      .all(projectId) as Array<Record<string, unknown>>;

    let expectedPrev = ZERO_HASH;
    let verified = 0;

    for (const row of rows) {
      const prevHash = row.prev_hash as string;
      const thisHash = row.this_hash as string;

      // Confirm linkage: this row's prev_hash must equal expectedPrev
      if (prevHash !== expectedPrev) {
        return {
          valid: false,
          entriesVerified: verified,
          firstMismatchSeq: row.seq as number,
          error: `prev_hash linkage broken at seq ${row.seq}`,
        };
      }

      // Recompute this_hash
      const canonical = this.canonicalize({
        id: row.id as string,
        ts: row.ts as string,
        project_id: row.project_id as string,
        branch_id: (row.branch_id as string | null) ?? null,
        session_id: (row.session_id as string | null) ?? null,
        parent_session_id: (row.parent_session_id as string | null) ?? null,
        kind: row.kind as MemoryAuditKind,
        actor: JSON.parse(row.actor as string),
        target: row.target ? JSON.parse(row.target as string) : null,
        payload: JSON.parse(row.payload as string),
        prev_hash: prevHash,
      });
      const recomputed = this.hash(prevHash + canonical);

      if (recomputed !== thisHash) {
        return {
          valid: false,
          entriesVerified: verified,
          firstMismatchSeq: row.seq as number,
          error: `this_hash mismatch at seq ${row.seq} (tampered content)`,
        };
      }

      expectedPrev = thisHash;
      verified += 1;
    }

    return {
      valid: true,
      entriesVerified: verified,
      firstMismatchSeq: null,
    };
  }

  /** Returns recent audit entries (for Workbench audit log + federation) */
  listRecent(projectId: string, sinceSeq: number, limit: number): AuditEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM audit_entries
         WHERE project_id = ? AND seq > ?
         ORDER BY seq ASC LIMIT ?`
      )
      .all(projectId, sinceSeq, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToEntry(r));
  }

  /** Returns the latest seq for a project (0 if no entries) */
  latestSeq(projectId: string): number {
    const row = this.db
      .prepare('SELECT MAX(seq) AS maxSeq FROM audit_entries WHERE project_id = ?')
      .get(projectId) as { maxSeq: number | null } | undefined;
    return row?.maxSeq ?? 0;
  }

  // ─── Private ────────────────────────────────────────────────────────

  private canonicalize(entry: Omit<AuditEntry, 'seq' | 'this_hash' | 'cloud_sig'>): string {
    // Stable key order; this is the canonical form hashed (matches D7.13)
    return JSON.stringify({
      id: entry.id,
      ts: entry.ts,
      project_id: entry.project_id,
      branch_id: entry.branch_id,
      session_id: entry.session_id,
      parent_session_id: entry.parent_session_id,
      kind: entry.kind,
      actor: entry.actor,
      target: entry.target,
      payload: entry.payload,
      prev_hash: entry.prev_hash,
    });
  }

  private hash(input: string): string {
    const bytes = new TextEncoder().encode(input);
    const h = blake3(bytes);
    let s = '';
    for (let i = 0; i < 32; i++) {
      s += (h[i] as number).toString(16).padStart(2, '0');
    }
    return s;
  }

  private rowToEntry(row: Record<string, unknown>): AuditEntry {
    return {
      seq: row.seq as number,
      id: row.id as string,
      ts: row.ts as string,
      project_id: row.project_id as string,
      branch_id: (row.branch_id as string | null) ?? null,
      session_id: (row.session_id as string | null) ?? null,
      parent_session_id: (row.parent_session_id as string | null) ?? null,
      kind: row.kind as MemoryAuditKind,
      actor: JSON.parse(row.actor as string),
      target: row.target ? JSON.parse(row.target as string) : null,
      payload: JSON.parse(row.payload as string),
      prev_hash: row.prev_hash as string,
      this_hash: row.this_hash as string,
      cloud_sig: (row.cloud_sig as string | null) ?? null,
    };
  }
}
