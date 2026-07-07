# @orqenix/memory-engine

> Apache-2.0 memory engine for Orqenix. The keystone that wires the 3-level
> hierarchy, branch deep-copy, subagent harness, parallel query, and audit chain.
> Phase 8 Foundation (D8.α.6). Charter gates G58 + G59 + G60 (38 sub-criteria).

## What this engine wires

D8.α.6 implements the actual memory engine that prior deliveries stubbed:

| Stub                                       | Now wired                                  |
| ------------------------------------------ | ------------------------------------------ |
| `ProjectIndex.query()` (D8.α.3)            | Real hybrid search vs SQLite memory.db     |
| `ProjectIndex.fetchFullContent()` (D8.α.3) | Real blob fetch                            |
| Audit chain writer (D8.α.3/α.4)            | Real BLAKE3 chain (extends Phase 7 D7.13)  |
| `RegistryPersistence` (D8.α.4)             | SQLite `installed_plugins` (Migration 540) |
| `SettingsPersistence` (D8.α.5)             | SQLite `config_overrides` (Migration 560)  |

## Architecture (CR v8.0 Chapters 4 + 5)

```
MemoryEngine (facade)
├── HierarchyQuery   , parallel 3-step (session → branch → project)
├── BranchStore      , deep-copy at creation (ADR-E-003)
├── SubagentHarness  , no-matrix subagent + return absorber (ADR-E-002)
├── PromotionEngine  , session→branch→project promotion
├── CompressGuard    , protection_flags enforcement (INV-13)
└── AuditChainWriter , BLAKE3 single chain per project (INV-3)
        │
        ▼
SqliteStore (better-sqlite3 + sqlite-vec) + BlobStore (content-addressed)
```

## 3-Level Hierarchy

Every level (project → branch → session) has the full 4×4 Memory × Knowledge
Matrix (T1-T4 × Chat/Code/Decision/Lesson) per CR v8.0 Section 4.2.

```
Project (project_id = blake3 of Ed25519)
├── Branch (branch_id = blake3(project_id + ":" + branch_name))
│   ├── Session (session_id = ULID)
│   └── Session ...
└── Branch ...
```

## Key invariants enforced

- **INV-11**: Branch creation deep-copies parent context (independent indexes)
- **INV-12**: Query runs all 3 levels in parallel, NO short-circuit
- **INV-13**: Subagent returns never compressed/tier-moved (protection_flags)
- **INV-3**: Single BLAKE3 audit chain per project (branch/session metadata)
- **ADR-E-002**: Subagents have no matrix; parent absorbs returns to T1+T2
- **ADR-E-003**: Branch deep-copy (not COW) for isolation correctness

## Usage

```ts
import { MemoryEngine } from "@orqenix/memory-engine";

const engine = await MemoryEngine.open("./.orqenix/memory.db", {
  projectId: "blake3:7f2ac8d1...",
});

// Write to a session
await engine.write({
  kb: "decision",
  content: "Use Stripe for billing",
  branchId: "blake3:main...",
  sessionId: "01J3X8H9...",
  memoryLevel: "session",
});

// Parallel 3-step query (session → branch → project)
const results = await engine.query({
  query: "billing approach",
  sessionId: "01J3X8H9...",
  branchId: "blake3:main...",
  projectId: "blake3:7f2ac8d1...",
  limit: 20,
});

// Branch deep-copy
await engine.createBranch({
  parentBranchId: "blake3:main...",
  newBranchName: "feature/stripe",
});

// Subagent (no matrix; parent absorbs return)
const ret = await engine.invokeSubagent({
  parentSessionId: "01J3X8H9...",
  harness: {
    /* ... */
  },
});
```

## License

Apache-2.0 , see ./LICENSE
