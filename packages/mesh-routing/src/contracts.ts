// SPDX-License-Identifier: Apache-2.0
// @bc CS-023 Mesh Routing Contracts
// @gate G34, G35

import { z } from 'zod';
import { OrqenixError } from '@orqenix/core';
import { SCOPE_ID_PATTERN } from '@orqenix/scope-identity';
import type { ProvenanceChain } from '@orqenix/provenance';

export const MeshQuerySchema = z.object({
  text: z.string().min(1).max(8192),
  k: z.number().int().positive().max(50).default(5),
  targetScopeIds: z.array(z.string().regex(SCOPE_ID_PATTERN)).max(64).optional(),
  timeoutMs: z.number().int().min(50).max(60_000).default(5_000),
}).strict();
export type MeshQuery = z.infer<typeof MeshQuerySchema>;

export interface MeshQueryHit {
  scopeId: string;
  text: string;
  score: number;
  provenance: ProvenanceChain;
}

export interface MeshScopeResult {
  scopeId: string;
  hits: MeshQueryHit[];
  durationMs: number;
  ok: true;
}

export interface MeshScopeFailure {
  scopeId: string;
  durationMs: number;
  ok: false;
  reason: 'timeout' | 'auth' | 'transport' | 'unlinked' | 'unknown';
  message: string;
}

export type MeshScopeOutcome = MeshScopeResult | MeshScopeFailure;

export interface MeshQueryResponse {
  query: MeshQuery;
  scopesQueried: number;
  scopesSucceeded: number;
  hits: MeshQueryHit[];
  outcomes: MeshScopeOutcome[];
  totalDurationMs: number;
  quorumReached: boolean;
}

export interface AutoLinkSuggestion {
  scopeId: string;
  reason: 'frequent-failure' | 'frequent-success' | 'high-relevance';
  evidence: { sampleSize: number; ratio: number };
}

export class MeshRoutingError extends OrqenixError {
  constructor(reason: string) { super(`mesh routing error: ${reason}`, 'MESH_ROUTING'); }
}
