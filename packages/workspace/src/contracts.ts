// SPDX-License-Identifier: Apache-2.0
// @bc CS-022 Workspace Contracts
// @gate G31

import { z } from 'zod';
import { OrqenixError, type Brand } from '@orqenix/core';
import { SCOPE_ID_PATTERN } from '@orqenix/scope-identity';

export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export const WORKSPACE_ID_PATTERN = /^ws:[A-Z2-7]{32}$/;

export const MEMBERSHIP_ROLES = ['owner', 'contributor', 'observer'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const WorkspaceSchema = z.object({
  id: z.string().regex(WORKSPACE_ID_PATTERN),
  name: z.string().min(1).max(128),
  ownerScopeId: z.string().regex(SCOPE_ID_PATTERN),
  createdAt: z.string().datetime({ offset: true }),
  description: z.string().max(512).optional(),
  metadata: z.record(z.unknown()).default({}),
}).strict();
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const MembershipSchema = z.object({
  workspaceId: z.string().regex(WORKSPACE_ID_PATTERN),
  scopeId: z.string().regex(SCOPE_ID_PATTERN),
  role: z.enum(MEMBERSHIP_ROLES),
  joinedAt: z.string().datetime({ offset: true }),
}).strict();
export type Membership = z.infer<typeof MembershipSchema>;

export class WorkspaceNotFoundError extends OrqenixError {
  constructor(id: string) { super(`workspace not found: ${id}`, 'WORKSPACE_NOT_FOUND'); }
}
export class WorkspaceAlreadyExistsError extends OrqenixError {
  constructor(id: string) { super(`workspace already exists: ${id}`, 'WORKSPACE_EXISTS'); }
}
export class MembershipNotFoundError extends OrqenixError {
  constructor(ws: string, scope: string) { super(`membership not found: ${ws}/${scope}`, 'MEMBERSHIP_NOT_FOUND'); }
}
export class MembershipAlreadyExistsError extends OrqenixError {
  constructor(ws: string, scope: string) { super(`membership already exists: ${ws}/${scope}`, 'MEMBERSHIP_EXISTS'); }
}
export class OwnerRemovalError extends OrqenixError {
  constructor() { super('cannot remove the owner from their own workspace', 'OWNER_REMOVAL'); }
}
