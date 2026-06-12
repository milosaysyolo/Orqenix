// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-observer , Observer core
//
// Captures observation events with PII filtering + opt-out config + 3-level
// context. Per CR v8.0 Section 9.4.1 + INV-17.

import type { Database } from 'better-sqlite3';
import { ulid } from '@orqenix/memory-engine';
import {
  type CaptureEventInput,
  type ObservationEvent,
  type ObserverConfig,
  type ObserverScope,
  type PiiFilter,
  DEFAULT_OBSERVER_CONFIG,
  NoopPiiFilter,
} from './types';

export interface ObserverOptions {
  db: Database;
  piiFilter?: PiiFilter;
}

/**
 * The Observer captures workflow events for pattern detection.
 *
 * Opt-out (INV-17): if the resolved config for the event's scope is disabled,
 * the event is dropped. Config is resolved session → branch → project; if ANY
 * level is disabled, capture is skipped (most restrictive wins).
 */
export class Observer {
  private readonly db: Database;
  private readonly piiFilter: PiiFilter;

  constructor(options: ObserverOptions) {
    this.db = options.db;
    this.piiFilter = options.piiFilter ?? new NoopPiiFilter();
  }

  /**
   * Captures an observation event. Returns the stored event, or null if
   * observation is disabled for this scope or sampled out.
   */
  capture(input: CaptureEventInput): ObservationEvent | null {
    // Resolve effective config (most restrictive across levels)
    const config = this.resolveConfig({
      projectId: input.projectId,
      branchId: input.branchId ?? null,
      sessionId: input.sessionId,
    });

    if (!config.enabled) {
      return null; // opt-out: observation disabled
    }

    // Sampling
    if (config.sampleRate < 1.0 && Math.random() > config.sampleRate) {
      return null;
    }

    // PII filtering (action + outcome payloads)
    let actionPayload = input.actionPayload;
    let outcomePayload = input.outcomePayload ?? null;
    let piiApplied = false;
    const redactionNotes: string[] = [];

    if (config.piiFilterEnabled) {
      const actionRedaction = this.piiFilter.redact(input.actionPayload);
      actionPayload = actionRedaction.redacted;
      if (actionRedaction.applied) {
        piiApplied = true;
        if (actionRedaction.notes) redactionNotes.push(actionRedaction.notes);
      }
      if (outcomePayload) {
        const outcomeRedaction = this.piiFilter.redact(outcomePayload);
        outcomePayload = outcomeRedaction.redacted;
        if (outcomeRedaction.applied) {
          piiApplied = true;
          if (outcomeRedaction.notes) redactionNotes.push(outcomeRedaction.notes);
        }
      }
    }

    const event: ObservationEvent = {
      id: ulid(),
      timestamp: new Date().toISOString(),
      project_id: input.projectId,
      branch_id: input.branchId ?? null,
      session_id: input.sessionId,
      parent_session_id: input.parentSessionId ?? null,
      agent_platform: input.agentPlatform ?? null,
      actor_kind: input.actorKind,
      actor_id: input.actorId,
      action_kind: input.actionKind,
      action_payload: actionPayload,
      outcome_kind: input.outcomeKind ?? null,
      outcome_duration_ms: input.outcomeDurationMs ?? null,
      outcome_payload: outcomePayload,
      pii_redaction_applied: piiApplied,
      redaction_notes: redactionNotes.length > 0 ? redactionNotes.join('; ') : null,
    };

    this.persist(event);
    return event;
  }

  /** Queries recent observation events for a scope */
  query(input: {
    projectId: string;
    branchId?: string;
    sessionId?: string;
    actionKind?: string;
    limit?: number;
  }): ObservationEvent[] {
    const conditions: string[] = ['project_id = @projectId'];
    const params: Record<string, unknown> = { projectId: input.projectId };
    if (input.branchId) {
      conditions.push('branch_id = @branchId');
      params.branchId = input.branchId;
    }
    if (input.sessionId) {
      conditions.push('session_id = @sessionId');
      params.sessionId = input.sessionId;
    }
    if (input.actionKind) {
      conditions.push('action_kind = @actionKind');
      params.actionKind = input.actionKind;
    }
    const limit = input.limit ?? 1000;

    const rows = this.db
      .prepare(
        `SELECT * FROM observation_events WHERE ${conditions.join(' AND ')} ORDER BY timestamp ASC LIMIT ${limit}`
      )
      .all(params) as Array<Record<string, unknown>>;
    return rows.map((r) => this.rowToEvent(r));
  }

  /** Sets observer config for a scope */
  setConfig(scope: ObserverScope, hierarchyId: string, config: Partial<ObserverConfig>): void {
    const existing = this.getConfig(scope, hierarchyId);
    const merged = { ...existing, ...config };
    this.db
      .prepare(
        `INSERT INTO observer_config (scope, hierarchy_id, config_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(scope, hierarchy_id) DO UPDATE SET config_json = excluded.config_json, updated_at = excluded.updated_at`
      )
      .run(scope, hierarchyId, JSON.stringify(merged), new Date().toISOString());
  }

  /** Gets observer config for a scope (default if not set) */
  getConfig(scope: ObserverScope, hierarchyId: string): ObserverConfig {
    const row = this.db
      .prepare('SELECT config_json FROM observer_config WHERE scope = ? AND hierarchy_id = ?')
      .get(scope, hierarchyId) as { config_json: string } | undefined;
    if (!row) return { ...DEFAULT_OBSERVER_CONFIG };
    return { ...DEFAULT_OBSERVER_CONFIG, ...JSON.parse(row.config_json) };
  }

  /** Returns total event count for a project */
  count(projectId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM observation_events WHERE project_id = ?')
      .get(projectId) as { c: number };
    return row.c;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  /** Resolves config across levels; most restrictive (disabled) wins */
  private resolveConfig(ctx: {
    projectId: string;
    branchId: string | null;
    sessionId: string;
  }): ObserverConfig {
    const projectCfg = this.getConfig('project', ctx.projectId);
    if (!projectCfg.enabled) return projectCfg;

    if (ctx.branchId) {
      const branchCfg = this.getConfig('branch', ctx.branchId);
      if (!branchCfg.enabled) return branchCfg;
    }

    const sessionCfg = this.getConfig('session', ctx.sessionId);
    if (!sessionCfg.enabled) return sessionCfg;

    // All enabled: use the most specific (session) for sampleRate/pii
    return sessionCfg;
  }

  private persist(event: ObservationEvent): void {
    this.db
      .prepare(
        `INSERT INTO observation_events (
          id, project_id, branch_id, session_id, parent_session_id, timestamp,
          agent_platform, actor_kind, actor_id, action_kind, action_payload_json,
          outcome_kind, outcome_duration_ms, outcome_payload_json,
          pii_redaction_applied, redaction_notes
        ) VALUES (
          @id, @projectId, @branchId, @sessionId, @parentSessionId, @timestamp,
          @agentPlatform, @actorKind, @actorId, @actionKind, @actionPayload,
          @outcomeKind, @outcomeDurationMs, @outcomePayload,
          @piiApplied, @redactionNotes
        )`
      )
      .run({
        id: event.id,
        projectId: event.project_id,
        branchId: event.branch_id,
        sessionId: event.session_id,
        parentSessionId: event.parent_session_id,
        timestamp: event.timestamp,
        agentPlatform: event.agent_platform,
        actorKind: event.actor_kind,
        actorId: event.actor_id,
        actionKind: event.action_kind,
        actionPayload: JSON.stringify(event.action_payload),
        outcomeKind: event.outcome_kind,
        outcomeDurationMs: event.outcome_duration_ms,
        outcomePayload: event.outcome_payload ? JSON.stringify(event.outcome_payload) : null,
        piiApplied: event.pii_redaction_applied ? 1 : 0,
        redactionNotes: event.redaction_notes,
      });
  }

  private rowToEvent(row: Record<string, unknown>): ObservationEvent {
    return {
      id: row.id as string,
      timestamp: row.timestamp as string,
      project_id: row.project_id as string,
      branch_id: (row.branch_id as string | null) ?? null,
      session_id: row.session_id as string,
      parent_session_id: (row.parent_session_id as string | null) ?? null,
      agent_platform: (row.agent_platform as string | null) ?? null,
      actor_kind: row.actor_kind as ObservationEvent['actor_kind'],
      actor_id: row.actor_id as string,
      action_kind: row.action_kind as string,
      action_payload: JSON.parse((row.action_payload_json as string) ?? '{}'),
      outcome_kind: (row.outcome_kind as ObservationEvent['outcome_kind']) ?? null,
      outcome_duration_ms: (row.outcome_duration_ms as number | null) ?? null,
      outcome_payload: row.outcome_payload_json
        ? JSON.parse(row.outcome_payload_json as string)
        : null,
      pii_redaction_applied: Boolean(row.pii_redaction_applied),
      redaction_notes: (row.redaction_notes as string | null) ?? null,
    };
  }
}
