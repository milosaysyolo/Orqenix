// SPDX-License-Identifier: Apache-2.0
// @bc CS-024 Audit Log Contracts
// @gate G18

import { z } from "zod";
import { OrqenixError } from "@orqenix/core";
import { SCOPE_ID_PATTERN } from "@orqenix/scope-identity";
import { CONTENT_HASH_PATTERN } from "@orqenix/storage-diff";

export const AUDIT_EVENT_KINDS = [
  // identity + tokens
  "scope_initialized",
  "token_issued",
  "token_revoked",
  // links
  "link_created",
  "link_activated",
  "link_revoked",
  // workspaces
  "workspace_created",
  "workspace_deleted",
  "member_added",
  "member_removed",
  "ownership_transferred",
  // kb + mesh
  "kb_write",
  "kb_delete",
  "mesh_query_run",
  // distillation
  "memory_distilled",
  // detach
  "scope_detached",
] as const;
export type AuditEventKind = (typeof AUDIT_EVENT_KINDS)[number];

export const AuditEntrySchema = z
  .object({
    rowid: z.number().int().nonnegative(),
    scopeId: z.string().regex(SCOPE_ID_PATTERN),
    actorScopeId: z.string().regex(SCOPE_ID_PATTERN),
    eventKind: z.enum(AUDIT_EVENT_KINDS),
    payload: z.record(z.unknown()),
    prevHash: z.union([z.string().regex(CONTENT_HASH_PATTERN), z.null()]),
    contentHash: z.string().regex(CONTENT_HASH_PATTERN),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AppendAuditInputSchema = z
  .object({
    actorScopeId: z.string().regex(SCOPE_ID_PATTERN),
    eventKind: z.enum(AUDIT_EVENT_KINDS),
    payload: z.record(z.unknown()).default({}),
  })
  .strict();
export type AppendAuditInput = z.infer<typeof AppendAuditInputSchema>;

export class AuditChainBrokenError extends OrqenixError {
  constructor(reason: string) {
    super(`audit chain broken: ${reason}`, "AUDIT_CHAIN");
  }
}
export class AuditEntryInvalidError extends OrqenixError {
  constructor(reason: string) {
    super(`audit entry invalid: ${reason}`, "AUDIT_INVALID");
  }
}
