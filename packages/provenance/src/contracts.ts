// SPDX-License-Identifier: Apache-2.0
// @bc CS-021 Provenance Contracts
// @gate G33

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';
import { SCOPE_ID_PATTERN } from '@orqenix/scope-identity';
import { TOKEN_ID_PATTERN } from '@orqenix/capability-tokens';
import { CONTENT_HASH_PATTERN } from '@orqenix/storage-diff';

export const PROVENANCE_SOURCES = ['local', 'mesh', 'distilled', 'imported'] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export const ProvenanceTagSchema = z.object({
  sourceScopeId: z.string().regex(SCOPE_ID_PATTERN),
  tokenJti: z.string().regex(TOKEN_ID_PATTERN).optional(),
  originPath: z.string().min(1).max(1024).optional(),
  producedAt: z.string().datetime({ offset: true }),
  sourceKind: z.enum(PROVENANCE_SOURCES),
  parentChainHash: z.string().regex(CONTENT_HASH_PATTERN).optional(),
}).strict().refine((t) => !(t.sourceKind === 'mesh' && !t.tokenJti), {
  message: 'mesh source must carry a tokenJti',
});
export type ProvenanceTag = z.infer<typeof ProvenanceTagSchema>;

export const ProvenanceChainSchema = z.object({
  tags: z.array(ProvenanceTagSchema).min(1).max(32),
  chainHash: z.string().regex(CONTENT_HASH_PATTERN),
}).strict();
export type ProvenanceChain = z.infer<typeof ProvenanceChainSchema>;

export class ProvenanceChainBrokenError extends OrqenixError {
  constructor(reason: string) { super(`provenance chain broken: ${reason}`, 'PROVENANCE_BROKEN'); }
}
export class InvalidProvenanceTagError extends OrqenixError {
  constructor(reason: string) { super(`invalid provenance tag: ${reason}`, 'PROVENANCE_INVALID'); }
}
