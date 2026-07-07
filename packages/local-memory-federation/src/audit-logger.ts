// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Audit logger
//
// Records all cross-project federation events in the relevant project's
// audit chain. Per CR v8.0 Section 4.9 + Anti-pattern 34.

import type { FederationAuditKind, FederationAuditEvent, ProjectId } from "./types";

/**
 * Interface for the underlying audit chain implementation.
 * Federation logger writes events but doesn't manage the chain itself.
 * D8.α.6 (Memory Engine) provides the concrete chain via @orqenix/memory-engine.
 */
export interface AuditChainWriter {
  append(event: FederationAuditEvent): Promise<void>;
}

/**
 * Stub implementation for D8.α.3 standalone testing.
 * Logs events to a local array; doesn't write to actual audit chain.
 * D8.α.6 substitutes the real implementation.
 */
export class InMemoryAuditChainWriter implements AuditChainWriter {
  private readonly events: FederationAuditEvent[] = [];

  async append(event: FederationAuditEvent): Promise<void> {
    this.events.push(event);
  }

  /** Returns events recorded (for tests) */
  getEvents(): readonly FederationAuditEvent[] {
    return [...this.events];
  }

  /** Clears recorded events (for tests) */
  clear(): void {
    this.events.length = 0;
  }
}

/**
 * High-level audit logger for federation operations.
 * Wraps an AuditChainWriter and provides typed methods per audit kind.
 */
export class AuditLogger {
  constructor(
    private readonly writer: AuditChainWriter,
    private readonly userId: string,
  ) {}

  /** Logs a cross-project query attempt */
  async logCrossProjectQuery(input: {
    projectId: ProjectId;
    sourceProjectIds: ProjectId[];
    queryHash: string;
    candidatesReturned: number;
    durationMs: number;
  }): Promise<void> {
    return this.write("memory.cross_project_query", input.projectId, {
      source_project_ids: input.sourceProjectIds,
      query_hash: input.queryHash,
      candidates_returned: input.candidatesReturned,
      duration_ms: input.durationMs,
    });
  }

  /** Logs a cross-project approval grant or revocation */
  async logApproval(input: {
    projectId: ProjectId;
    sourceProjectId: ProjectId;
    targetProjectId: ProjectId;
    scope: Record<string, boolean>;
    expiresAt: string;
    action: "granted" | "revoked";
  }): Promise<void> {
    return this.write("memory.cross_project_approval", input.projectId, {
      source_project_id: input.sourceProjectId,
      target_project_id: input.targetProjectId,
      scope: input.scope,
      expires_at: input.expiresAt,
      action: input.action,
    });
  }

  /** Logs an actual data share (after user clicks Approve on a candidate) */
  async logShare(input: {
    projectId: ProjectId;
    sourceProjectId: ProjectId;
    candidateId: string;
    candidateKind: string;
    contentHash: string;
  }): Promise<void> {
    return this.write("memory.cross_project_share", input.projectId, {
      source_project_id: input.sourceProjectId,
      candidate_id: input.candidateId,
      candidate_kind: input.candidateKind,
      content_hash: input.contentHash,
    });
  }

  private async write(
    kind: FederationAuditKind,
    projectId: ProjectId,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event: FederationAuditEvent = {
      kind,
      ts: new Date().toISOString(),
      projectId,
      actor: { user: this.userId },
      payload,
    };
    await this.writer.append(event);
  }
}
