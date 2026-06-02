// SPDX-License-Identifier: Apache-2.0
// @bc CS-025 Detach Contracts
// @gate G17, G30

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';
import { SCOPE_ID_PATTERN } from '@orqenix/scope-identity';
import { CONTENT_HASH_PATTERN } from '@orqenix/storage-diff';

export const DETACH_KINDS = ['unlink-remote', 'full-detach'] as const;
export type DetachKind = (typeof DETACH_KINDS)[number];

export const ConfirmationTokenPattern = /^detach:[A-Z2-7]{32}$/;

export const DetachPlanSchema = z.object({
  kind: z.enum(DETACH_KINDS),
  localScopeId: z.string().regex(SCOPE_ID_PATTERN),
  targetScopeId: z.string().regex(SCOPE_ID_PATTERN).optional(),
  affectedLinks: z.number().int().nonnegative(),
  affectedTokens: z.number().int().nonnegative(),
  affectedMemberships: z.number().int().nonnegative(),
  auditEntriesPreserved: z.number().int().nonnegative(),
  confirmationToken: z.string().regex(ConfirmationTokenPattern),
  preparedAt: z.string().datetime({ offset: true }),
}).strict();
export type DetachPlan = z.infer<typeof DetachPlanSchema>;

export const DetachReportSchema = DetachPlanSchema.extend({
  executedAt: z.string().datetime({ offset: true }),
  verifierChainHash: z.string().regex(CONTENT_HASH_PATTERN).nullable(),
}).strict();
export type DetachReport = z.infer<typeof DetachReportSchema>;

export class InvalidConfirmationError extends OrqenixError {
  constructor(reason: string) { super(`invalid detach confirmation: ${reason}`, 'DETACH_CONFIRM'); }
}
export class DetachStateError extends OrqenixError {
  constructor(reason: string) { super(`detach state error: ${reason}`, 'DETACH_STATE'); }
}
