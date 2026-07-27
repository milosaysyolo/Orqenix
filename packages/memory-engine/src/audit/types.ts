// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , Audit chain types

/** Phase 8 audit kinds (CR v8.0 Section 4.9) */
export type MemoryAuditKind =
  // Project-level
  | "project.migrated_from_phase_7"
  | "project.config_updated"
  // Branch-level
  | "branch.deep_cloned_from_parent"
  | "branch.first_activity"
  | "branch.config_updated"
  // Session-level
  | "session.started"
  | "session.paused"
  | "session.resumed"
  | "session.deleted"
  | "session.subagent_spawned"
  | "session.team_session_joined"
  | "session.team_session_left"
  // Subagent
  | "subagent.spawn"
  | "subagent.return_absorbed"
  // Memory promotion
  | "memory.promoted.session_to_branch"
  | "memory.promoted.branch_to_project"
  | "memory.promoted.project_to_cross_project"
  // Link state
  | "link.created"
  | "link.activated"
  | "link.deactivated"
  | "link.severed"
  // Memory write
  | "memory.write";

export interface ActorRef {
  kind: "user" | "agent" | "subagent" | "system";
  id: string;
}

export interface TargetRef {
  kind: string;
  id: string;
  label?: string;
}

export interface ProvenanceInfo {
  origin: "local" | "cloud" | "scope";
  component?: string;
}

/** An audit entry (extends Phase 7 D7.13 shape with hierarchy fields) */
export interface AuditEntry {
  seq: number;
  id: string;
  ts: string;
  /** project_id (formerly tenant_id in Phase 7) */
  project_id: string;
  /** null = project-level event */
  branch_id: string | null;
  /** null = branch-level event */
  session_id: string | null;
  /** for subagent chains */
  parent_session_id: string | null;
  kind: MemoryAuditKind;
  actor: ActorRef;
  target: TargetRef | null;
  payload: Record<string, unknown>;
  prev_hash: string;
  this_hash: string;
  /** Optional Cloud signature (Phase 7 D7.13 cloud signer) */
  cloud_sig: string | null;
}

/** Input for appending an audit entry */
export interface AppendAuditInput {
  project_id: string;
  branch_id?: string | null;
  session_id?: string | null;
  parent_session_id?: string | null;
  kind: MemoryAuditKind;
  actor: ActorRef;
  target?: TargetRef;
  payload: Record<string, unknown>;
}

/** Result of verifying the chain */
export interface ChainVerifyResult {
  valid: boolean;
  entriesVerified: number;
  /** seq of first mismatch (null if valid) */
  firstMismatchSeq: number | null;
  error?: string;
}
