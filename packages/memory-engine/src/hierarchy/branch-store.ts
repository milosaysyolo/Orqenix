// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Branch store (deep-copy, ADR-E-003)
//
// Branch creation DEEP-COPIES parent index rows (NOT COW). Blob content is
// shared via BLAKE3 content addressing + ref-count increment. This preserves
// isolation correctness during parallel development per ADR-E-003 + INV-11.

import type { Database } from "better-sqlite3";
import { blake3 } from "@noble/hashes/blake3";
import { BlobStore } from "../store/blob-store";
import { ulid } from "../store/ulid";
import type { KbKind, Tier } from "../store/types";
import { type CreateBranchInput, type CreateBranchResult } from "./types";

const KB_TABLES: Array<{ kb: KbKind; table: string }> = [
  { kb: "chat", table: "chat_entries" },
  { kb: "code", table: "code_entries" },
  { kb: "decision", table: "decision_entries" },
  { kb: "lesson", table: "lesson_entries" },
];

const TIER_FILTER: Record<NonNullable<CreateBranchInput["cloneTiers"]>, Tier[]> = {
  all: ["T1", "T2", "T3", "T4"],
  t1_t2_only: ["T1", "T2"],
  t1_only: ["T1"],
};

export class BranchStore {
  constructor(
    private readonly db: Database,
    private readonly blobs: BlobStore,
  ) {}

  /**
   * Computes branch_id deterministically per CR v8.0 Section 4.1:
   *   branch_id = blake3(project_id + ":" + branch_name)
   */
  static computeBranchId(projectId: string, branchName: string): string {
    const input = `${projectId}:${branchName}`;
    const bytes = new TextEncoder().encode(input);
    const h = blake3(bytes);
    let s = "blake3:";
    for (let i = 0; i < 8; i++) {
      s += (h[i] as number).toString(16).padStart(2, "0");
    }
    return s;
  }

  /**
   * Creates a new branch by DEEP-COPYING parent index rows (ADR-E-003).
   *
   * Index rows are duplicated with the new branch_id. Blob content is NOT
   * duplicated; BLAKE3 content addressing shares blobs via ref-count increment.
   *
   * Isolation guarantee: after this operation, writes to either branch do NOT
   * affect the other (independent index rows). This prevents goal drift when
   * the parent branch later merges from sibling branches.
   */
  createBranch(input: CreateBranchInput): CreateBranchResult {
    const startMs = Date.now();
    const newBranchId = BranchStore.computeBranchId(input.projectId, input.newBranchName);
    const now = new Date().toISOString();
    const tiers = TIER_FILTER[input.cloneTiers ?? "all"];
    const tierList = tiers.map((t) => `'${t}'`).join(",");

    const cellSnapshot: Record<string, Record<string, number>> = {
      T1: {},
      T2: {},
      T3: {},
      T4: {},
    };
    let indexRowsCloned = 0;
    let blobReferencesReused = 0;

    // Run the deep copy in a transaction for atomicity
    const txn = this.db.transaction(() => {
      for (const { kb, table } of KB_TABLES) {
        // Read parent branch entries at branch + project level (not session)
        const parentRows = this.db
          .prepare(
            `SELECT * FROM ${table}
             WHERE project_id = @projectId
               AND branch_id = @parentBranchId
               AND memory_level IN ('branch','project')
               AND tier IN (${tierList})`,
          )
          .all({
            projectId: input.projectId,
            parentBranchId: input.parentBranchId,
          }) as Record<string, unknown>[];

        for (const row of parentRows) {
          const newId = ulid();
          // INSERT new index row with new branch_id (deep copy of index)
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
                @projectId, @newBranchId, NULL, @memoryLevel,
                @protectionFlags, @parentBranchId,
                NULL, NULL,
                @createdAt, @updatedAt
              )`,
            )
            .run({
              id: newId,
              hash: row.hash,
              tier: row.tier,
              content: row.content,
              embedding: row.embedding,
              projectId: input.projectId,
              newBranchId,
              memoryLevel: row.memory_level,
              protectionFlags: row.protection_flags ?? null,
              parentBranchId: input.parentBranchId,
              createdAt: now,
              updatedAt: now,
            });

          // Increment blob ref count (content shared, not duplicated)
          if (row.content === null && typeof row.hash === "string") {
            this.blobs.addRef(row.hash);
            blobReferencesReused += 1;
          }

          indexRowsCloned += 1;
          const tier = row.tier as string;
          const cell = cellSnapshot[tier];
          if (cell) {
            cell[kb] = (cell[kb] ?? 0) + 1;
          }
        }
      }

      // Record the branch
      this.db
        .prepare(
          `INSERT INTO branches (
            branch_id, project_id, branch_name, created_at,
            cloned_from_branch_id, cell_snapshot
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newBranchId,
          input.projectId,
          input.newBranchName,
          now,
          input.parentBranchId,
          JSON.stringify(cellSnapshot),
        );
    });

    txn();

    return {
      branchId: newBranchId,
      branchName: input.newBranchName,
      cellSnapshot: cellSnapshot as CreateBranchResult["cellSnapshot"],
      indexRowsCloned,
      blobReferencesReused,
      durationMs: Date.now() - startMs,
    };
  }

  /** Returns whether a branch exists */
  branchExists(branchId: string): boolean {
    const row = this.db.prepare("SELECT 1 FROM branches WHERE branch_id = ?").get(branchId);
    return row !== undefined;
  }

  /** Lists branches for a project */
  listBranches(projectId: string): Array<{
    branchId: string;
    branchName: string;
    createdAt: string;
    clonedFromBranchId: string | null;
  }> {
    const rows = this.db
      .prepare(
        "SELECT branch_id, branch_name, created_at, cloned_from_branch_id FROM branches WHERE project_id = ? ORDER BY created_at ASC",
      )
      .all(projectId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      branchId: r.branch_id as string,
      branchName: r.branch_name as string,
      createdAt: r.created_at as string,
      clonedFromBranchId: (r.cloned_from_branch_id as string | null) ?? null,
    }));
  }
}
