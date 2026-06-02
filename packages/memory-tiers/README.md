# @orqenix/memory-tiers

4-tier memory model for the Orqenix Memory Matrix (CR v7.1 Chapter 9).

## Tiers

| Tier | Purpose | Mutability |
|------|---------|------------|
| working | Recent observations, low-confidence notes | mutable, demotable |
| episodic | Recurring facts, decisions, preferences | mutable, demotable |
| semantic | Verified knowledge, high-confidence learnings | mutable, NOT demotable |
| procedural | Skills and tasks promoted via repeated use | IMMUTABLE |

## Types (8 total)

`fact | preference | decision | task | learning | relationship | skill | observation`

## Promotion policy (defaults)

- `working -> episodic`: accessCount >= 2 AND age >= 60s
- `episodic -> semantic`: accessCount >= 5 AND age >= 7d AND confidence >= 0.75
- `semantic -> procedural`: accessCount >= 10 AND age >= 30d AND type in {skill, task}

All thresholds are configurable via `TierPromotionPolicy`.

## Idempotency

`MemoryTierStore.insert()` deduplicates by `(content_hash, scope_id)` — re-running the distiller is safe.

Charter gate: **G23 Memory Tier Classification**.
