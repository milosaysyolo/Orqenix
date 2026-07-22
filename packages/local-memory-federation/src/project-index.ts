// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Project index abstraction
//
// Abstract interface for querying a project's local memory.
// Default implementation reads from project's .orqenix/memory.db (SQLite).
// Can be substituted for testing or alternative backends.

import type { KbKind, ProjectId, CandidatePreview } from './types';

export interface ProjectIndexQuery {
  query: string;
  kinds?: KbKind[];
  limit: number;
}

export interface ProjectIndexResult {
  candidates: CandidatePreview[];
}

/**
 * Abstract project index interface.
 * Implementations: SqliteProjectIndex (default), MockProjectIndex (testing).
 */
export interface IProjectIndex {
  /** Returns the project ID this index represents */
  getProjectId(): ProjectId;

  /** Returns human-readable name (from registry) */
  getProjectName(): string;

  /** Queries the project's local memory and returns candidate previews */
  query(input: ProjectIndexQuery): Promise<ProjectIndexResult>;

  /** Fetches the FULL content of a candidate after user approval */
  fetchFullContent(candidateId: string): Promise<string | null>;
}

/**
 * Default implementation: lazy filesystem-based index.
 *
 * For Phase 8 D8.α.3, we provide a stub that reads from the project's
 * memory.db. Full integration with the Memory Engine ships in D8.α.6.
 *
 * This stub returns empty results until D8.α.6 wires it to the real engine.
 */
export class ProjectIndex implements IProjectIndex {
  private readonly projectId: ProjectId;
  private readonly projectName: string;
  constructor(input: {
    projectId: ProjectId;
    projectName: string;
    projectPath: string;
  }) {
    this.projectId = input.projectId;
    this.projectName = input.projectName;
  }

  getProjectId(): ProjectId {
    return this.projectId;
  }

  getProjectName(): string {
    return this.projectName;
  }

  async query(_input: ProjectIndexQuery): Promise<ProjectIndexResult> {
    // STUB for D8.α.3: returns empty results.
    //
    // D8.α.6 (Memory Engine + Hierarchy) wires this to actual SQLite query
    // via @orqenix/memory-engine's HybridSearch + hierarchical query.
    //
    // The stub allows D8.α.3 to deliver federation orchestration + permission
    // + audit + cache infrastructure without blocking on Memory Engine work.
    //
    // When D8.α.6 ships, this method becomes:
    //   const engine = await import('@orqenix/memory-engine');
    //   return engine.querySingleProject({ projectId, projectPath, ... });
    return {
      candidates: [],
    };
  }

  async fetchFullContent(_candidateId: string): Promise<string | null> {
    // STUB for D8.α.3: returns null.
    // D8.α.6 wires this to actual content fetch.
    return null;
  }
}
