// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Public API surface
//
// Phase 8 Foundation (D8.α.3)
// Charter gates: G58-09, G58-10, G58-11
//
// All federation operations are pull-on-demand and require explicit opt-in
// per CR v8.0 ADR-E-011 + INV-18.

// ─────────────────────────────────────────────────────────────────────────
// Engine (top-level orchestrator)
// ─────────────────────────────────────────────────────────────────────────

export { FederationEngine } from "./federation-engine";

// ─────────────────────────────────────────────────────────────────────────
// Discovery + Index
// ─────────────────────────────────────────────────────────────────────────

export { ProjectDiscovery } from "./project-discovery";
export { ProjectIndex } from "./project-index";

// ─────────────────────────────────────────────────────────────────────────
// Aggregator + Permission + Cache + Audit
// ─────────────────────────────────────────────────────────────────────────

export { QueryAggregator } from "./query-aggregator";
export { PermissionChecker } from "./permission-checker";
export { CacheLayer } from "./cache-layer";
export { AuditLogger } from "./audit-logger";

// ─────────────────────────────────────────────────────────────────────────
// Types (re-export from types.ts)
// ─────────────────────────────────────────────────────────────────────────

export type {
  KbKind,
  ProjectId,
  ProjectRegistration,
  FederationApproval,
  CrossProjectQuery,
  CandidatePreview,
  FederationResult,
  FederationEngineConfig,
  ApproveCandidateRequest,
  FederationAuditKind,
  FederationAuditEvent,
} from "./types";

export {
  KbKindSchema,
  ProjectIdSchema,
  ProjectRegistrationSchema,
  ProjectsYamlSchema,
  FederationApprovalSchema,
  FederationApprovalsYamlSchema,
  CrossProjectQuerySchema,
  ApproveCandidateRequestSchema,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────
// Errors (re-export from errors.ts)
// ─────────────────────────────────────────────────────────────────────────

export {
  FederationError,
  FederationDisabledError,
  NoApprovalError,
  ExpiredApprovalError,
  ProjectNotFoundError,
  RegistryError,
  CandidateNotFoundError,
  PermissionError,
} from "./errors";
