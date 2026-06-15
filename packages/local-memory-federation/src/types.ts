// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Type definitions

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// Memory KB kinds (matches CR v8.0 Section 4.2)
// ─────────────────────────────────────────────────────────────────────────

export type KbKind = 'chat' | 'code' | 'decision' | 'lesson';

export const KbKindSchema = z.enum(['chat', 'code', 'decision', 'lesson']);

// ─────────────────────────────────────────────────────────────────────────
// Project identification
// ─────────────────────────────────────────────────────────────────────────

/** BLAKE3-derived project identity (Phase 6 scope_id renamed) */
export type ProjectId = string & { readonly __projectId: unique symbol };

export const ProjectIdSchema = z
  .string()
  .regex(/^blake3:[0-9a-f]{8,64}$/, 'Invalid project_id format (expected blake3:<hex>)')
  .transform((s) => s as ProjectId);

// ─────────────────────────────────────────────────────────────────────────
// Project registration (from ~/.orqenix/projects.yaml)
// ─────────────────────────────────────────────────────────────────────────

export const ProjectRegistrationSchema = z.object({
  id: ProjectIdSchema,
  name: z.string().min(1),
  path: z.string().min(1),
  registered_at: z.string().datetime(),
  /** Whether THIS project participates in federation (opt-in) */
  cross_project_sharing_enabled: z.boolean().default(false),
});

export type ProjectRegistration = z.infer<typeof ProjectRegistrationSchema>;

export const ProjectsYamlSchema = z.object({
  projects: z.array(ProjectRegistrationSchema),
});

export type ProjectsYaml = z.infer<typeof ProjectsYamlSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Federation approvals (from ~/.orqenix/federation-approvals.yaml)
// ─────────────────────────────────────────────────────────────────────────

export const FederationApprovalSchema = z.object({
  /** Source project: provides the candidate */
  source_project_id: ProjectIdSchema,
  /** Target project: receives the candidate (typically current project) */
  target_project_id: ProjectIdSchema,
  /** Per-KB scope of allowed sharing */
  scope: z.object({
    chat: z.boolean().default(false),
    code: z.boolean().default(false),
    decision: z.boolean().default(true),
    lesson: z.boolean().default(true),
  }),
  approved_by: z.string().min(1),
  approved_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export type FederationApproval = z.infer<typeof FederationApprovalSchema>;

export const FederationApprovalsYamlSchema = z.object({
  approvals: z.array(FederationApprovalSchema),
});

// ─────────────────────────────────────────────────────────────────────────
// Cross-project query request/response
// ─────────────────────────────────────────────────────────────────────────

export const CrossProjectQuerySchema = z.object({
  /** Search query text */
  query: z.string().min(1),
  /** Optional filter: only these KB kinds */
  kinds: z.array(KbKindSchema).optional(),
  /** Max candidates per project */
  limit: z.number().int().positive().max(100).default(20),
  /** Skip cache (force fresh fetch) */
  skipCache: z.boolean().default(false),
});

export type CrossProjectQuery = z.infer<typeof CrossProjectQuerySchema>;

export interface CandidatePreview {
  /** Unique candidate ID (ULID) */
  id: string;
  /** Source project that contains this candidate */
  source_project_id: ProjectId;
  source_project_name: string;
  /** KB kind of the candidate */
  kind: KbKind;
  /** Short preview (NOT full content; user must approve to receive full) */
  preview: string;
  /** Approximate relevance score 0-1 */
  relevance: number;
  /** When this entry was created in source project */
  created_at: string;
  /** Must be true for cross-project candidates per INV-18 */
  requires_approval: true;
}

export interface FederationResult {
  query: CrossProjectQuery;
  candidates: CandidatePreview[];
  /** Projects that were queried */
  projects_queried: ProjectId[];
  /** Projects that returned candidates (subset of projects_queried) */
  projects_with_results: ProjectId[];
  /** Total query duration (ms) */
  duration_ms: number;
  /** Whether result came from cache */
  cache_hit: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Federation engine config
// ─────────────────────────────────────────────────────────────────────────

export interface FederationEngineConfig {
  /** Current user's project (queries originate here) */
  currentProjectId: ProjectId;
  /** User identifier (for audit + approval attribution) */
  userId: string;
  /** Override path for projects registry (default: ~/.orqenix/projects.yaml) */
  projectsYamlPath?: string;
  /** Override path for approvals registry (default: ~/.orqenix/federation-approvals.yaml) */
  approvalsYamlPath?: string;
  /** Cache TTL in milliseconds (default 5 min) */
  cacheTtlMs?: number;
  /** Maximum number of cached queries (default 100) */
  cacheMaxSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Approval request (user clicks "Approve" in Workbench)
// ─────────────────────────────────────────────────────────────────────────

export const ApproveCandidateRequestSchema = z.object({
  candidateId: z.string().min(1),
  approvedBy: z.string().min(1),
  /** Optional duration override (default 90 days) */
  expiresAtIso: z.string().datetime().optional(),
});

export type ApproveCandidateRequest = z.infer<typeof ApproveCandidateRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────
// Audit kinds (new in Phase 8 D8.α.3)
// ─────────────────────────────────────────────────────────────────────────

export type FederationAuditKind =
  | 'memory.cross_project_query'
  | 'memory.cross_project_approval'
  | 'memory.cross_project_share';

export interface FederationAuditEvent {
  kind: FederationAuditKind;
  ts: string;
  projectId: ProjectId;
  actor: { user: string };
  payload: Record<string, unknown>;
}
