// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Promotion engine
//
// Promotes memory entries up the hierarchy: session → branch → project.
// Per CR v8.0 Section 4.5. Promotion duplicates an entry to the target level
// with provenance tracking + audit.

import type { SqliteStore } from "../store/sqlite-store";
import type { KbKind } from "../store/types";
import type { PromoteInput } from "./types";

export interface PromotionResult {
  newEntryId: string;
  sourceEntryId: string;
  fromLevel: "session" | "branch";
  toLevel: "branch" | "project";
}

export class PromotionEngine {
  constructor(private readonly store: SqliteStore) {}

  /**
   * Promotes an entry from session→branch or branch→project.
   *
   * The entry is duplicated to the target level with promotion provenance.
   * The original entry is NOT removed (fabric model: data preserved).
   */
  promote(input: PromoteInput): PromotionResult {
    const source = this.store.getEntry(input.kb, input.entryId);
    if (!source) {
      throw new Error(`Entry ${input.entryId} not found in ${input.kb} KB`);
    }

    // Determine target level + scope
    const targetLevel = input.to;
    const targetBranchId =
      input.to === "branch" ? (input.toBranchId ?? input.fromBranchId) : input.fromBranchId; // project level keeps branch_id for provenance

    // Fetch full content (resolves blob if needed)
    const content = source.content ?? this.store.fetchContent(input.kb, input.entryId) ?? "";

    // Write the promoted copy at the target level
    const promoted = this.store.write({
      kb: input.kb,
      content,
      ...(source.embedding ? { embedding: source.embedding } : {}),
      tier: source.tier,
      project_id: input.projectId,
      branch_id: targetBranchId,
      // session_id is null at branch/project level
      memory_level: targetLevel,
      ...(input.from === "session" && input.fromSessionId
        ? { promoted_from_session_id: input.fromSessionId }
        : {}),
      ...(input.from === "branch" ? { promoted_from_branch_id: input.fromBranchId } : {}),
    });

    return {
      newEntryId: promoted.id,
      sourceEntryId: input.entryId,
      fromLevel: input.from,
      toLevel: input.to,
    };
  }

  /**
   * Auto-promotes high-scoring session entries to branch on success outcome.
   * Per CR v8.0 Section 4.5 (auto-promote on success, default ON).
   */
  autoPromoteSessionToBranch(input: {
    sessionId: string;
    branchId: string;
    projectId: string;
    kb: KbKind;
    entryIds: string[];
  }): PromotionResult[] {
    const results: PromotionResult[] = [];
    for (const entryId of input.entryIds) {
      results.push(
        this.promote({
          entryId,
          kb: input.kb,
          from: "session",
          to: "branch",
          fromSessionId: input.sessionId,
          fromBranchId: input.branchId,
          projectId: input.projectId,
        }),
      );
    }
    return results;
  }
}
