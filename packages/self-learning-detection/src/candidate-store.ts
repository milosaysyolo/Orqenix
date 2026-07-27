// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-detection , Candidate store
//
// Persists detected patterns as instinct_candidates with cooldown handling.

import type { Database } from "better-sqlite3";
import { ulid } from "@orqenix/memory-engine";
import type { DetectedPattern, InstinctCandidate, DetectionThresholds } from "./types";

export class CandidateStore {
  constructor(private readonly db: Database) {}

  /**
   * Upserts a detected pattern as a candidate.
   *
   * Cooldown (per thresholds): if a candidate with the same pattern_hash was
   * recently reviewed (rejected/deferred) within cooldownHours, skip re-surfacing.
   * Returns 'created' | 'updated' | 'cooldown'.
   */
  upsert(
    pattern: DetectedPattern,
    ctx: { projectId: string; branchId?: string | null; sessionId?: string | null },
    thresholds: DetectionThresholds,
  ): "created" | "updated" | "cooldown" {
    const existing = this.db
      .prepare("SELECT * FROM instinct_candidates WHERE project_id = ? AND pattern_hash = ?")
      .get(ctx.projectId, pattern.patternHash) as Record<string, unknown> | undefined;

    if (existing) {
      // Cooldown check for rejected/deferred candidates
      const status = existing.status as string;
      if ((status === "rejected" || status === "deferred") && existing.reviewed_at) {
        const reviewedMs = new Date(existing.reviewed_at as string).getTime();
        const cooldownMs = thresholds.cooldownHours * 3600 * 1000;
        if (Date.now() - reviewedMs < cooldownMs) {
          return "cooldown";
        }
      }

      // Update counts + impact (re-detected)
      this.db
        .prepare(
          `UPDATE instinct_candidates SET
            observation_count = ?, success_count = ?, total_count = ?,
            success_rate = ?, impact_score = ?, detected_at = ?,
            sample_observation_ids = ?,
            status = CASE WHEN status IN ('rejected','deferred') THEN 'detected' ELSE status END
           WHERE project_id = ? AND pattern_hash = ?`,
        )
        .run(
          pattern.occurrenceCount,
          pattern.successCount,
          pattern.occurrenceCount,
          pattern.successRate,
          pattern.impactScore,
          new Date().toISOString(),
          JSON.stringify(pattern.sampleObservationIds),
          ctx.projectId,
          pattern.patternHash,
        );
      return "updated";
    }

    // Create new candidate
    this.db
      .prepare(
        `INSERT INTO instinct_candidates (
          id, project_id, branch_id, session_id, pattern_hash, pattern_name,
          pattern_description, observation_count, success_count, total_count,
          success_rate, sample_observation_ids, detected_at, impact_score,
          status, reviewed_at, reviewed_by, review_decision, cross_scope, cross_scope_sources_json
        ) VALUES (
          @id, @projectId, @branchId, @sessionId, @patternHash, @patternName,
          @patternDescription, @occ, @succ, @total,
          @successRate, @sampleIds, @detectedAt, @impactScore,
          'detected', NULL, NULL, NULL, 0, NULL
        )`,
      )
      .run({
        id: ulid(),
        projectId: ctx.projectId,
        branchId: ctx.branchId ?? null,
        sessionId: ctx.sessionId ?? null,
        patternHash: pattern.patternHash,
        patternName: pattern.suggestedName,
        patternDescription: pattern.suggestedDescription,
        occ: pattern.occurrenceCount,
        succ: pattern.successCount,
        total: pattern.occurrenceCount,
        successRate: pattern.successRate,
        sampleIds: JSON.stringify(pattern.sampleObservationIds),
        detectedAt: new Date().toISOString(),
        impactScore: pattern.impactScore,
      });
    return "created";
  }

  /** Lists candidates by status, ranked by impact */
  list(projectId: string, status = "detected", limit = 50): InstinctCandidate[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM instinct_candidates WHERE project_id = ? AND status = ?
         ORDER BY impact_score DESC LIMIT ?`,
      )
      .all(projectId, status, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToCandidate(r));
  }

  /** Gets a single candidate by ID */
  get(id: string): InstinctCandidate | null {
    const row = this.db.prepare("SELECT * FROM instinct_candidates WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.rowToCandidate(row) : null;
  }

  /** Updates a candidate's review status (Promote/Reject/Defer) */
  setReviewStatus(
    id: string,
    status: "reviewed" | "promoted" | "rejected" | "deferred",
    reviewedBy: string,
    decision?: string,
  ): void {
    this.db
      .prepare(
        `UPDATE instinct_candidates SET status = ?, reviewed_at = ?, reviewed_by = ?, review_decision = ? WHERE id = ?`,
      )
      .run(status, new Date().toISOString(), reviewedBy, decision ?? null, id);
  }

  private rowToCandidate(row: Record<string, unknown>): InstinctCandidate {
    return {
      id: row.id as string,
      project_id: row.project_id as string,
      branch_id: (row.branch_id as string | null) ?? null,
      session_id: (row.session_id as string | null) ?? null,
      pattern_hash: row.pattern_hash as string,
      pattern_name: (row.pattern_name as string | null) ?? null,
      pattern_description: (row.pattern_description as string | null) ?? null,
      observation_count: row.observation_count as number,
      success_count: row.success_count as number,
      total_count: row.total_count as number,
      success_rate: row.success_rate as number,
      sample_observation_ids: row.sample_observation_ids as string,
      detected_at: row.detected_at as string,
      impact_score: row.impact_score as number,
      status: row.status as InstinctCandidate["status"],
      reviewed_at: (row.reviewed_at as string | null) ?? null,
      reviewed_by: (row.reviewed_by as string | null) ?? null,
      review_decision: (row.review_decision as string | null) ?? null,
      cross_scope: Boolean(row.cross_scope),
      cross_scope_sources_json: (row.cross_scope_sources_json as string | null) ?? null,
    };
  }
}
