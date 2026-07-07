// SPDX-License-Identifier: Apache-2.0
export const PHASE_REGISTRY = {
  "phase-1-2": {
    name: "Memory Engine Core + Injection Strategies",
    provides: {
      packages: ["@orqenix/memory-engine"],
      exports: ["MemoryEngine", "ulid", "SqliteStore", "HybridSearch"],
      contracts: ["5 injection strategies A-E (default B)", "4 KB matrix", "tier T1-T4"],
    },
    consumes: [],
  },
  "phase-3": {
    name: "Knowledge Bases (Storage)",
    provides: {
      packages: ["@orqenix/memory-engine"],
      exports: ["BlobStore"],
      contracts: ["diff-only storage BLAKE3 + zstd", "4 STRICT KB tables", "content-hash dedup"],
    },
    consumes: ["phase-1-2"],
  },
  "phase-4": {
    name: "Distillation + Reindex + Prompt Rewriter + Hybrid Search",
    provides: {
      packages: ["@orqenix/memory-engine"],
      exports: ["HybridSearch", "DEFAULT_WEIGHTS"],
      contracts: ["vector 0.5 + BM25 0.3 + trigram 0.1 + recency 0.1", "RTK noise filter"],
    },
    consumes: ["phase-3"],
  },
  "phase-5": {
    name: "Memory Foundation Refactor (ChatKB + capability tokens)",
    provides: {
      packages: ["@orqenix/plugin-core"],
      exports: ["PermissionChecker", "STANDARD_PERMISSIONS"],
      contracts: ["capability tokens", "ChatKB hash-chained entries", "diff-only ChatKB"],
    },
    consumes: ["phase-3", "phase-4"],
  },
  "phase-6": {
    name: "LAN Mesh + Identity",
    provides: {
      packages: ["@orqenix/local-memory-federation"],
      exports: ["FederationEngine", "ProjectDiscovery", "PermissionChecker"],
      contracts: ["scope identity Ed25519 + BLAKE3 scope_id", "capability-based links", "no-DHT"],
    },
    consumes: ["phase-5"],
  },
  "phase-7": {
    name: "Cloud tier (relay + witness + audit chain + privacy)",
    provides: {
      packages: ["@orqenix/memory-engine"],
      exports: ["AuditChainWriter"],
      contracts: [
        "single BLAKE3 audit chain per project",
        "D7.13 canonical form",
        "verifiable chain",
      ],
    },
    consumes: ["phase-6"],
  },
  "phase-8": {
    name: "Workbench + Hierarchy + Plugins + Marketplace + Self-Learning",
    provides: {
      packages: [
        "@orqenix/workbench",
        "@orqenix/ui-primitives",
        "@orqenix/memory-engine",
        "@orqenix/plugin-core",
        "@orqenix/settings-registry",
        "@orqenix/mcp-server",
        "@orqenix/marketplace-core",
        "@orqenix/normalization-engine",
        "@orqenix/self-learning-observer",
        "@orqenix/self-learning-detection",
        "@orqenix/skill-genesis",
        "@orqenix/verification-loop",
        "@orqenix/migration-phase-7-to-8",
      ],
      exports: [
        "HierarchyQuery",
        "BranchStore",
        "SubagentHarnessManager",
        "ReturnAbsorber",
        "OrqenixMcpServer",
        "MarketplaceManager",
        "NormalizationEngine",
        "Observer",
        "BasicDetector",
        "SkillGenesis",
        "VerificationLoop",
        "Migrator",
      ],
      contracts: [
        "3-level hierarchy (project/branch/session)",
        "branch deep-copy (ADR-E-003)",
        "subagent no-matrix (ADR-E-002)",
        "14 plugin kinds",
        "round-trip fidelity (INV-15)",
        "observer opt-out (INV-17)",
        "cross-project show-not-share (INV-18)",
      ],
    },
    consumes: ["phase-1-2", "phase-3", "phase-4", "phase-5", "phase-6", "phase-7"],
  },
};

export const MIGRATION_ORDER = [
  { id: 500, phase: "phase-8", name: "hierarchy-columns" },
  { id: 501, phase: "phase-8", name: "sessions-branches-tables" },
  { id: 502, phase: "phase-8", name: "audit-entries-blobs" },
  { id: 530, phase: "phase-8", name: "self-learning-observer" },
  { id: 540, phase: "phase-8", name: "installed-plugins" },
  { id: 550, phase: "phase-8", name: "marketplace-state" },
  { id: 560, phase: "phase-8", name: "config-overrides" },
];
