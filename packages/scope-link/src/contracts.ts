// SPDX-License-Identifier: Apache-2.0
// @bc CS-020 Scope Link Contracts
// @gate G29

import { z } from "zod";
import { OrqenixError } from "@orqenix/core";
import { SCOPE_ID_PATTERN } from "@orqenix/scope-identity";
import { TOKEN_ID_PATTERN } from "@orqenix/capability-tokens";

export const LINK_DIRECTIONS = ["outbound", "inbound"] as const;
export type LinkDirection = (typeof LINK_DIRECTIONS)[number];

export const LINK_STATUSES = ["pending", "active", "revoked"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

export const ScopeLinkSchema = z
  .object({
    localScopeId: z.string().regex(SCOPE_ID_PATTERN),
    remoteScopeId: z.string().regex(SCOPE_ID_PATTERN),
    direction: z.enum(LINK_DIRECTIONS),
    status: z.enum(LINK_STATUSES),
    displayName: z.string().min(1).max(128).optional(),
    capabilityTokenJti: z.string().regex(TOKEN_ID_PATTERN).optional(),
    createdAt: z.string().datetime({ offset: true }),
    lastSyncedAt: z.string().datetime({ offset: true }).optional(),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict()
  .refine((l) => l.localScopeId !== l.remoteScopeId, {
    message: "localScopeId and remoteScopeId must differ (no self-link)",
  });
export type ScopeLink = z.infer<typeof ScopeLinkSchema>;

export class LinkNotFoundError extends OrqenixError {
  constructor(local: string, remote: string, direction: LinkDirection) {
    super(`scope link not found: ${local} -[${direction}]-> ${remote}`, "LINK_NOT_FOUND");
  }
}
export class LinkAlreadyExistsError extends OrqenixError {
  constructor(local: string, remote: string, direction: LinkDirection) {
    super(`scope link already exists: ${local} -[${direction}]-> ${remote}`, "LINK_EXISTS");
  }
}
export class LinkStateError extends OrqenixError {
  constructor(reason: string) {
    super(`link state error: ${reason}`, "LINK_STATE");
  }
}
