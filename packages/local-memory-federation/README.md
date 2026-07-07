# @orqenix/local-memory-federation

> Pull-on-demand cross-project memory federation for Orqenix.
> Strictly opt-in per CR v8.0 ADR-E-011 + INV-18.

## Phase

- **Phase**: 8 Foundation (D8.α.3)
- **Charter gate**: G58-09 / G58-10 / G58-11 (Cross-scope sharing defaults)

## Mission

Enable a user with multiple Orqenix projects on their local machine to query memory across those projects, with explicit opt-in approval per project pair. Data NEVER crosses project boundary without user clicking "Approve".

## Key invariants

| Invariant                                          | Source                                      |
| -------------------------------------------------- | ------------------------------------------- |
| Cross-project sharing OFF by default               | CR v8.0 Section 4.3 sharing defaults        |
| Pull-on-demand (no push, no sync)                  | ADR-E-014                                   |
| User approval required per cross-project promotion | ADR-E-011 + INV-18                          |
| Project boundaries are intentional                 | Section 2.2                                 |
| Audit cross-project queries                        | New audit kind `memory.cross_project_query` |

## Architecture overview

```
User query → PermissionChecker → ProjectDiscovery → FederationEngine
                                                     ↓
                                  QueryAggregator (parallel via Promise.all)
                                                     ↓
                                  CacheLayer (5-min TTL LRU)
                                                     ↓
                                  AuditLogger
                                                     ↓
                                  Workbench UI surfaces candidates
                                  (user clicks Approve per candidate)
```

## Usage

```ts
import { FederationEngine } from "@orqenix/local-memory-federation";

const engine = new FederationEngine({
  currentProjectId: "blake3:7f2ac8d100000000",
  userId: "milo@example.com",
});

const results = await engine.crossProjectQuery({
  query: "authentication patterns",
  limit: 20,
  // Optional filters
  kinds: ["decision", "lesson"],
});

// Results contain candidates but data not shared yet
for (const candidate of results.candidates) {
  console.log(candidate.preview); // Surface-level preview
  console.log(candidate.source_project_id); // Provenance
  console.log(candidate.requires_approval); // Always true for cross-project
}

// User explicitly approves a candidate (in Workbench UI)
await engine.approveCandidate({
  candidateId: "cand_xyz",
  approvedBy: "milo@example.com",
});
// Now data is shared and indexed in current project
```

## Project Discovery

User registers projects for federation by adding them to `~/.orqenix/projects.yaml`:

```yaml
# ~/.orqenix/projects.yaml
projects:
  - id: blake3:7f2ac8d100000000
    name: orqenix-cloud
    path: /home/milo/code/Orqenix-Cloud
    registered_at: 2026-06-10T12:00:00Z
    cross_project_sharing_enabled: false # Default OFF
  - id: blake3:3a8c91f200000000
    name: orqenix-os
    path: /home/milo/code/Orqenix
    registered_at: 2026-06-11T09:00:00Z
    cross_project_sharing_enabled: true # Opt-in
```

User must explicitly enable `cross_project_sharing_enabled` per project AND per project pair via Workbench UI.

## Permission model

Cross-project federation requires:

1. Both source and target projects must have `cross_project_sharing_enabled: true`
2. User must approve the specific PAIR via Workbench (stored in `~/.orqenix/federation-approvals.yaml`)
3. Each approval is time-bounded (default 90 days, renewable)
4. Approval includes a permission scope (e.g., "only Decision KB", "only LessonKB")

## Audit trail

Every cross-project query is logged in both source and target projects:

```
memory.cross_project_query
  payload: {
    source_project_id, target_project_id, query_hash, candidates_returned, ...
  }
```

Every approval is logged:

```
memory.cross_project_approval
  payload: {
    candidate_id, approved_by, scope, expires_at, ...
  }
```

## What it does NOT do

- ❌ Push notifications across projects
- ❌ Real-time sync between projects
- ❌ Auto-merge candidates without approval
- ❌ Cross-machine federation (use Cloud relay for that)
- ❌ Federated learning model training (separate Pro feature in D8.γ)

## License

Apache-2.0 , see ./LICENSE
