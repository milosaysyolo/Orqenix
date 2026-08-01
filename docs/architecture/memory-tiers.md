# Memory Tiers (Phase 3)

## Problem

Agent context needs persistent memory across multi-day sessions, machine
restarts, and crashes. Different memory types need different lifespans:
working state vs decisions vs project-wide patterns.

## Constraints

- Never RAM-only (must survive crash/restart)
- TTL per tier, configurable
- Cleanup must respect protected entries and checkpoints
- Export/import as JSON always available (Rule 5: no lock-in)
- Cross-platform (SQLite, no native deps issues)

## Design

### Four tiers, four SQLite files

```
.orqenix/memory/working.db    Tier 1: per-session, optional TTL
.orqenix/memory/episodic.db   Tier 2: per-scope, 7d default
.orqenix/memory/semantic.db   Tier 3: per-project, 90d default
.orqenix/memory/global.db     Tier 4: opt-in, cross-scope (Phase 5 cluster)
```

Each DB is independent, indexed by `scope` and `timestamp`. WAL mode for
concurrent reads during writes.

### Cleanup strategy

`planCleanup()` produces a dry-run plan showing:

- Tier name
- Candidate count
- Total bytes to free
- Protected count (always kept)
- Checkpoint count (always kept)
- Strategy: LRU or importance-weighted

`executeCleanup()` applies the plan in a transaction. Atomic: either all
entries removed or none.

### Sweep vs Cleanup

- **Sweep**: removes entries past their `expiresAt` timestamp. Cheap, can
  run frequently.
- **Cleanup**: applies retention policy (age + strategy). User-confirmed
  before execution.

### Export/Import

`exportScope()` returns `{tier: MemoryEntry[]}` JSON. User can:

- Backup before risky operations
- Migrate between machines
- Transfer between projects

Import overwrites entries with matching IDs. No conflict resolution beyond
last-write-wins. Sufficient for backup/restore.

## Tradeoffs

- Chose **4 separate SQLite files** over **single DB with tier column**.
  Isolation: corruption in one tier doesn't affect others.

- Chose **LRU + importance** as cleanup strategies.

- Chose **manual prompt** as cleanup mode default. Auto mode exists but
  not default because deleting memory without user consent is hostile.

## Open questions

- Should `episodic` tier auto-promote high-importance entries to `semantic`?
  Currently no; user decides via `importance` field. Phase 5 may add
  auto-promotion via cluster knowledge.

- Should we expose a memory query language (like JSONPath)?
  Currently filter object only. Sufficient for Phase 3.

## References

- Working/Episodic/Semantic memory model (cognitive science origin)
- SQLite WAL mode docs (concurrency model)
- Monetization Lock Chapter 3.2 (persistence is free; intelligence is paid)
