// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Query aggregator
//
// Runs queries across multiple ProjectIndex instances in parallel and merges
// results with weighted ranking. Per CR v8.0 INV-12 + Section 4.4 (parallel
// query, no short-circuit).

import type {
  CandidatePreview,
  CrossProjectQuery,
  ProjectId,
} from './types';
import type { IProjectIndex } from './project-index';

export interface QueryAggregatorInput {
  query: CrossProjectQuery;
  indexes: IProjectIndex[];
}

export interface QueryAggregatorResult {
  candidates: CandidatePreview[];
  projectsQueried: ProjectId[];
  projectsWithResults: ProjectId[];
  perProjectDurations: Map<ProjectId, number>;
}

/**
 * Aggregates queries across multiple projects.
 *
 * Strategy:
 *   1. Run all queries in parallel via Promise.all (per INV-12 no short-circuit)
 *   2. Merge candidates with relevance score
 *   3. Sort by relevance descending
 *   4. Apply limit
 */
export class QueryAggregator {
  /** Run parallel queries and merge results */
  async aggregate(
    input: QueryAggregatorInput
  ): Promise<QueryAggregatorResult> {
    const startTime = Date.now();

    // Parallel query (per INV-12: no short-circuit, no early-exit)
    const perProjectResults = await Promise.allSettled(
      input.indexes.map(async (index) => {
        const queryStart = Date.now();
        try {
          const result = await index.query({
            query: input.query.query,
            ...(input.query.kinds !== undefined ? { kinds: input.query.kinds } : {}),
            limit: input.query.limit,
          });
          return {
            projectId: index.getProjectId(),
            candidates: result.candidates,
            duration: Date.now() - queryStart,
          };
        } catch (err) {
          // Per INV-12: failure of one project does NOT short-circuit others
          return {
            projectId: index.getProjectId(),
            candidates: [],
            duration: Date.now() - queryStart,
            error: err,
          };
        }
      })
    );

    // Collect successful results
    const projectsQueried: ProjectId[] = input.indexes.map((idx) =>
      idx.getProjectId()
    );
    const projectsWithResults: ProjectId[] = [];
    const perProjectDurations = new Map<ProjectId, number>();
    const merged: CandidatePreview[] = [];

    for (const res of perProjectResults) {
      if (res.status === 'fulfilled') {
        perProjectDurations.set(res.value.projectId, res.value.duration);
        if (res.value.candidates.length > 0) {
          projectsWithResults.push(res.value.projectId);
          merged.push(...res.value.candidates);
        }
      }
    }

    // Sort by relevance (descending), break ties by created_at (newest first)
    merged.sort((a, b) => {
      if (a.relevance !== b.relevance) {
        return b.relevance - a.relevance;
      }
      return b.created_at.localeCompare(a.created_at);
    });

    // Apply limit
    const limitedCandidates = merged.slice(0, input.query.limit);

    return {
      candidates: limitedCandidates,
      projectsQueried,
      projectsWithResults,
      perProjectDurations,
    };
  }
}
