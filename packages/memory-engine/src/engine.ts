// SPDX-License-Identifier: Apache-2.0
// @orqenix/memory-engine , MemoryEngine facade
//
// Top-level facade coordinating all subsystems. This is the keystone that
// wires the actual memory engine consumed by Workbench, federation, plugins,
// and settings.

import { SqliteStore } from "./store/sqlite-store";
import { HybridSearch } from "./store/hybrid-search";
import { HierarchyQuery } from "./hierarchy/hierarchy-query";
import { BranchStore } from "./hierarchy/branch-store";
import { PromotionEngine } from "./hierarchy/promotion";
import { SubagentHarnessManager } from "./subagent/harness";
import { ReturnAbsorber } from "./subagent/return-absorber";
import { AuditChainWriter } from "./audit/chain-writer";
import { MigrationRunner, HIERARCHY_MIGRATIONS, BASE_KB_BOOTSTRAP } from "./migrations/index";
import type { KbKind, MemoryEntry, WriteEntryInput } from "./store/types";
import type {
  HierarchyQueryInput,
  HierarchyQueryResult,
  CreateBranchInput,
  CreateBranchResult,
  PromoteInput,
} from "./hierarchy/types";
import type { InvokeSubagentInput, AbsorbResult } from "./subagent/types";
import type { AuditEntry, ChainVerifyResult } from "./audit/types";

export interface MemoryEngineOptions {
  projectId: string;
  /** Bootstrap base KB tables (for standalone/testing). Default false. */
  bootstrapBaseTables?: boolean;
  /** Fail migration on checksum drift (default true) */
  failOnDrift?: boolean;
}

/**
 * MemoryEngine , the facade that wires the full Phase 8 memory subsystem.
 *
 * Subsystems:
 *   - SqliteStore        , persistence (WAL + blobs)
 *   - HybridSearch       , vector + BM25 + trigram + recency
 *   - HierarchyQuery     , parallel 3-step (INV-12)
 *   - BranchStore        , deep-copy (ADR-E-003)
 *   - PromotionEngine    , session→branch→project
 *   - SubagentHarness    , no-matrix subagent (ADR-E-002)
 *   - ReturnAbsorber     , parent absorbs return (T1+T2)
 *   - AuditChainWriter   , single BLAKE3 chain (INV-3)
 */
export class MemoryEngine {
  readonly projectId: string;
  private readonly store: SqliteStore;
  private readonly hybridSearch: HybridSearch;
  private readonly hierarchyQuery: HierarchyQuery;
  private readonly branchStore: BranchStore;
  private readonly promotionEngine: PromotionEngine;
  private readonly subagentHarness: SubagentHarnessManager;
  private readonly returnAbsorber: ReturnAbsorber;
  private readonly audit: AuditChainWriter;

  private constructor(store: SqliteStore, options: MemoryEngineOptions) {
    this.projectId = options.projectId;
    this.store = store;
    this.hybridSearch = new HybridSearch(store.db);
    this.hierarchyQuery = new HierarchyQuery(this.hybridSearch);
    this.branchStore = new BranchStore(store.db, store.blobs);
    this.promotionEngine = new PromotionEngine(store);
    this.subagentHarness = new SubagentHarnessManager();
    this.returnAbsorber = new ReturnAbsorber(store);
    this.audit = new AuditChainWriter(store.db);
  }

  /**
   * Opens a memory engine, running migrations.
   */
  static async open(dbPath: string, options: MemoryEngineOptions): Promise<MemoryEngine> {
    const store = new SqliteStore(dbPath);

    // Bootstrap base KB tables if requested (Phase 3 normally provides them)
    if (options.bootstrapBaseTables) {
      store.db.exec(BASE_KB_BOOTSTRAP);
    }

    // Run Phase 8 migrations
    const runner = new MigrationRunner(store.db);
    runner.apply(HIERARCHY_MIGRATIONS, options.failOnDrift ?? true);

    return new MemoryEngine(store, options);
  }

  // ─── Write ──────────────────────────────────────────────────────────

  /** Writes a memory entry + audits it */
  async write(input: Omit<WriteEntryInput, "project_id">): Promise<MemoryEntry> {
    const entry = this.store.write({
      ...input,
      project_id: this.projectId,
    });

    this.audit.append({
      project_id: this.projectId,
      branch_id: input.branch_id,
      session_id: input.session_id ?? null,
      kind: "memory.write",
      actor: { kind: "agent", id: input.session_id ?? "unknown" },
      payload: {
        kb: input.kb,
        tier: entry.tier,
        memory_level: input.memory_level,
        entry_id: entry.id,
        hash: entry.hash,
        protected: input.protection_flags != null,
      },
    });

    return entry;
  }

  // ─── Query (parallel 3-step, INV-12) ─────────────────────────────────

  /** Resolves a query across the 3 hierarchy levels in parallel */
  async query(input: Omit<HierarchyQueryInput, "projectId">): Promise<HierarchyQueryResult> {
    return this.hierarchyQuery.query({
      ...input,
      projectId: this.projectId,
    });
  }

  // ─── Branch deep-copy (ADR-E-003) ────────────────────────────────────

  /** Creates a branch by deep-copying parent context */
  async createBranch(input: Omit<CreateBranchInput, "projectId">): Promise<CreateBranchResult> {
    const result = this.branchStore.createBranch({
      ...input,
      projectId: this.projectId,
    });

    this.audit.append({
      project_id: this.projectId,
      branch_id: result.branchId,
      kind: "branch.deep_cloned_from_parent",
      actor: { kind: "system", id: "branch-store" },
      payload: {
        parent_branch_id: input.parentBranchId,
        new_branch_name: input.newBranchName,
        cell_snapshot: result.cellSnapshot,
        index_rows_cloned: result.indexRowsCloned,
        blob_references_reused: result.blobReferencesReused,
        duration_ms: result.durationMs,
        isolation_strategy: "deep_copy_independent_indexes",
      },
    });

    return result;
  }

  // ─── Promotion (session→branch→project) ──────────────────────────────

  /** Promotes an entry up the hierarchy */
  async promote(input: Omit<PromoteInput, "projectId">): Promise<void> {
    const result = this.promotionEngine.promote({
      ...input,
      projectId: this.projectId,
    });

    const auditKind =
      input.to === "branch"
        ? "memory.promoted.session_to_branch"
        : "memory.promoted.branch_to_project";

    this.audit.append({
      project_id: this.projectId,
      branch_id: input.toBranchId ?? input.fromBranchId,
      ...(input.fromSessionId ? { session_id: input.fromSessionId } : {}),
      kind: auditKind,
      actor: { kind: "user", id: input.fromSessionId ?? "unknown" },
      payload: {
        source_entry_id: result.sourceEntryId,
        new_entry_id: result.newEntryId,
        kb: input.kb,
        from: result.fromLevel,
        to: result.toLevel,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });
  }

  // ─── Subagent (no matrix, ADR-E-002) ─────────────────────────────────

  /**
   * Invokes a subagent and absorbs its return into the parent's T1+T2.
   *
   * The subagent has NO matrix. Its return is absorbed with strict protection
   * flags (never compress/move-tier) and surfaces at ×10 boost.
   */
  async invokeSubagent(input: Omit<InvokeSubagentInput, "projectId">): Promise<AbsorbResult> {
    // Audit the spawn
    const spawnEntry = this.audit.append({
      project_id: this.projectId,
      branch_id: input.branchId,
      session_id: input.parentSessionId,
      kind: "subagent.spawn",
      actor: { kind: "agent", id: input.parentSessionId },
      payload: {
        subagent_kind: input.harness.subagentKind,
        goal: input.harness.goal,
        scoped_context_refs: input.harness.scopedContext.entryIds,
        constraints: input.harness.constraints,
      },
    });

    // Run the subagent (no matrix allocated)
    const invocation = await this.subagentHarness.invoke({
      ...input,
      projectId: this.projectId,
    });

    // Absorb the return into parent's T1+T2
    const absorbed = this.returnAbsorber.absorb({
      ret: invocation.ret,
      subagentSessionId: invocation.subagentSessionId,
      subagentKind: invocation.subagentKind,
      parentSessionId: input.parentSessionId,
      branchId: input.branchId,
      projectId: this.projectId,
    });

    // Audit the absorption
    this.audit.append({
      project_id: this.projectId,
      branch_id: input.branchId,
      session_id: input.parentSessionId,
      parent_session_id: input.parentSessionId,
      kind: "subagent.return_absorbed",
      actor: { kind: "system", id: "return-absorber" },
      payload: {
        subagent_session_id: invocation.subagentSessionId,
        spawn_audit_id: spawnEntry.id,
        t1_entry_id: absorbed.t1EntryId,
        t2_entry_id: absorbed.t2EntryId,
        duration_ms: invocation.ret.wallTimeMs,
        output_matches_schema: invocation.ret.outputMatchesSchema,
      },
    });

    return absorbed;
  }

  // ─── Audit ──────────────────────────────────────────────────────────

  /** Verifies the project's audit chain integrity */
  verifyAuditChain(): ChainVerifyResult {
    return this.audit.verify(this.projectId);
  }

  /** Lists recent audit entries (for Workbench + federation) */
  listAudit(sinceSeq: number, limit: number): AuditEntry[] {
    return this.audit.listRecent(this.projectId, sinceSeq, limit);
  }

  // ─── Accessors (for federation, plugin registry, settings persistence) ─

  /** Returns the underlying SqliteStore (consumed by registry/settings persistence) */
  getStore(): SqliteStore {
    return this.store;
  }

  /** Returns the audit chain writer (consumed by federation + plugin audit) */
  getAuditWriter(): AuditChainWriter {
    return this.audit;
  }

  /** Returns the branch store (for listing branches in Workbench) */
  getBranchStore(): BranchStore {
    return this.branchStore;
  }

  /** Fetches full content for a specific entry (wires federation fetchFullContent) */
  fetchContent(kb: KbKind, entryId: string): string | null {
    return this.store.fetchContent(kb, entryId);
  }

  /** Closes the engine */
  close(): void {
    this.store.close();
  }
}
