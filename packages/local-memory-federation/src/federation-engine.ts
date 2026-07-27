// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Federation engine (top-level orchestrator)
//
// Orchestrates cross-project memory federation per CR v8.0 ADR-E-011 + INV-18.
// Pull-on-demand only; no background sync.

import { blake3 } from "@noble/hashes/blake3";

import { AuditLogger, AuditChainWriter, InMemoryAuditChainWriter } from "./audit-logger";
import { CacheLayer } from "./cache-layer";
import { PermissionChecker } from "./permission-checker";
import { ProjectDiscovery } from "./project-discovery";
import { ProjectIndex, IProjectIndex } from "./project-index";
import { QueryAggregator } from "./query-aggregator";

import {
  ApproveCandidateRequestSchema,
  CandidatePreview,
  CrossProjectQuery,
  CrossProjectQuerySchema,
  FederationEngineConfig,
  FederationResult,
  KbKind,
} from './types';

import {
  CandidateNotFoundError,
} from './errors';

/**
 * Top-level federation engine.
 *
 * Coordinates:
 *   - ProjectDiscovery (project registry)
 *   - PermissionChecker (per-pair, per-KB approval)
 *   - ProjectIndex (per-project query)
 *   - QueryAggregator (parallel merge)
 *   - CacheLayer (5-min LRU)
 *   - AuditLogger (audit chain entries)
 *
 * Usage:
 *   const engine = new FederationEngine({
 *     currentProjectId: 'blake3:...',
 *     userId: 'milo@example.com',
 *   });
 *   const result = await engine.crossProjectQuery({ query: '...' });
 */
export class FederationEngine {
  private readonly config: FederationEngineConfig;
  private readonly discovery: ProjectDiscovery;
  private readonly permissions: PermissionChecker;
  private readonly cache: CacheLayer;
  private readonly aggregator: QueryAggregator;
  private readonly audit: AuditLogger;
  private readonly auditWriter: AuditChainWriter;

  /** In-memory candidate registry; cleared when cache evicts */
  private readonly candidateRegistry: Map<string, CandidatePreview> = new Map();

  constructor(
    config: FederationEngineConfig,
    options?: {
      discovery?: ProjectDiscovery;
      permissions?: PermissionChecker;
      cache?: CacheLayer;
      aggregator?: QueryAggregator;
      auditWriter?: AuditChainWriter;
    },
  ) {
    this.config = config;
    this.discovery = options?.discovery ?? new ProjectDiscovery(config.projectsYamlPath);
    this.permissions = options?.permissions ?? new PermissionChecker(config.approvalsYamlPath);
    this.cache =
      options?.cache ??
      new CacheLayer({
        ...(config.cacheTtlMs !== undefined ? { ttlMs: config.cacheTtlMs } : {}),
        ...(config.cacheMaxSize !== undefined ? { maxSize: config.cacheMaxSize } : {}),
      });
    this.aggregator = options?.aggregator ?? new QueryAggregator();
    this.auditWriter = options?.auditWriter ?? new InMemoryAuditChainWriter();
    this.audit = new AuditLogger(this.auditWriter, config.userId);
  }

  /**
   * Executes a cross-project query.
   *
   * Steps:
   *   1. Validate query input (Zod)
   *   2. Check cache
   *   3. Discover federation-enabled projects (excluding current)
   *   4. Filter by per-pair approvals
   *   5. Build per-project ProjectIndex instances
   *   6. Run parallel queries
   *   7. Cache result
   *   8. Audit the query
   *   9. Return candidates (NOT data, just previews)
   */
  async crossProjectQuery(queryInput: unknown): Promise<FederationResult> {
    const startTime = Date.now();

    // 1. Validate
    const validated = CrossProjectQuerySchema.parse(queryInput);

    // 2. Check cache
    if (!validated.skipCache) {
      const cached = this.cache.get(this.config.currentProjectId, validated);
      if (cached) {
        // Cache hit; re-register candidates so approveCandidate can find them
        for (const cand of cached.candidates) {
          this.candidateRegistry.set(cand.id, cand);
        }
        return { ...cached, cache_hit: true };
      }
    }

    // 3. Discover all federation-enabled projects
    const allProjects = await this.discovery.listFederationEnabledProjects();
    const otherProjects = allProjects.filter((p) => p.id !== this.config.currentProjectId);

    if (otherProjects.length === 0) {
      // No other projects opted in, return empty result (not an error)
      const emptyResult = this.makeEmptyResult(validated, startTime, false);
      this.cache.set(this.config.currentProjectId, validated, emptyResult);
      return emptyResult;
    }

    // 4. Filter by per-pair approval for at least one KB kind
    const kindsToCheck: KbKind[] = validated.kinds ?? ["chat", "code", "decision", "lesson"];
    const eligibleProjects: IProjectIndex[] = [];

    for (const project of otherProjects) {
      let approvedForAnyKind = false;
      for (const kind of kindsToCheck) {
        const check = await this.permissions.check({
          sourceProjectId: project.id,
          targetProjectId: this.config.currentProjectId,
          kind,
        });
        if (check.allowed) {
          approvedForAnyKind = true;
          break;
        }
      }

      if (approvedForAnyKind) {
        eligibleProjects.push(
          new ProjectIndex({
            projectId: project.id,
            projectName: project.name,
            projectPath: project.path,
          }),
        );
      }
    }

    if (eligibleProjects.length === 0) {
      const emptyResult = this.makeEmptyResult(validated, startTime, false);
      this.cache.set(this.config.currentProjectId, validated, emptyResult);
      return emptyResult;
    }

    // 5. Run parallel queries
    const aggregated = await this.aggregator.aggregate({
      query: validated,
      indexes: eligibleProjects,
    });

    // 6. Register candidates so approveCandidate can look them up
    for (const cand of aggregated.candidates) {
      this.candidateRegistry.set(cand.id, cand);
    }

    // 7. Build result
    const result: FederationResult = {
      query: validated,
      candidates: aggregated.candidates,
      projects_queried: aggregated.projectsQueried,
      projects_with_results: aggregated.projectsWithResults,
      duration_ms: Date.now() - startTime,
      cache_hit: false,
    };

    // 8. Cache it
    this.cache.set(this.config.currentProjectId, validated, result);

    // 9. Audit
    const queryHash = this.hashQuery(validated);
    await this.audit.logCrossProjectQuery({
      projectId: this.config.currentProjectId,
      sourceProjectIds: aggregated.projectsQueried,
      queryHash,
      candidatesReturned: result.candidates.length,
      durationMs: result.duration_ms,
    });

    return result;
  }

  /**
   * User explicitly approves a candidate to share into current project.
   * Only after this call does data actually cross the project boundary.
   */
  async approveCandidate(input: unknown): Promise<void> {
    const validated = ApproveCandidateRequestSchema.parse(input);
    const candidate = this.candidateRegistry.get(validated.candidateId);

    if (!candidate) {
      throw new CandidateNotFoundError(validated.candidateId);
    }

    // Fetch full content from source project
    const sourceProject = await this.discovery.findProject(candidate.source_project_id);
    const sourceIndex = new ProjectIndex({
      projectId: sourceProject.id,
      projectName: sourceProject.name,
      projectPath: sourceProject.path,
    });

    const fullContent = await sourceIndex.fetchFullContent(candidate.id);
    if (fullContent === null) {
      // D8.α.6 will wire this; in D8.α.3 stub it returns null
      throw new CandidateNotFoundError(
        `Full content for ${validated.candidateId} unavailable (D8.α.6 will wire fetch)`,
      );
    }

    // Compute content hash for audit
    const bytes = new TextEncoder().encode(fullContent);
    const contentHash = Array.from(blake3(bytes))
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Audit the share
    await this.audit.logShare({
      projectId: this.config.currentProjectId,
      sourceProjectId: candidate.source_project_id,
      candidateId: candidate.id,
      candidateKind: candidate.kind,
      contentHash,
    });

    // D8.α.6 will wire actual ingestion into current project's memory.
    // For D8.α.3, the audit + permission check are the deliverable.
  }

  /** Returns the current cache size (for diagnostics) */
  getCacheSize(): number {
    return this.cache.size();
  }

  /** Clears all caches (for tests + reset) */
  clearCache(): void {
    this.cache.clear();
    this.candidateRegistry.clear();
  }

  /** Returns the audit writer (mostly for tests) */
  getAuditWriter(): AuditChainWriter {
    return this.auditWriter;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────

  private makeEmptyResult(
    query: CrossProjectQuery,
    startTime: number,
    cacheHit: boolean,
  ): FederationResult {
    return {
      query,
      candidates: [],
      projects_queried: [],
      projects_with_results: [],
      duration_ms: Date.now() - startTime,
      cache_hit: cacheHit,
    };
  }

  private hashQuery(query: CrossProjectQuery): string {
    const canonical = JSON.stringify({
      q: query.query,
      kinds: query.kinds ? [...query.kinds].sort() : null,
      limit: query.limit,
    });
    const bytes = new TextEncoder().encode(canonical);
    const hash = blake3(bytes);
    return Array.from(hash)
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
