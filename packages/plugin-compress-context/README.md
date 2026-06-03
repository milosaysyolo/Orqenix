# @orqenix/plugin-compress-context

Phase 5 v2 of the context-compression plugin. **Two entry points**:

| Entry                                                                  | Surface                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------ |
| `import plugin from '@orqenix/plugin-compress-context'`                | Phase 4 v1 contract (frozen — snapshot-tested in G1.6) |
| `import { createV2Plugin } from '@orqenix/plugin-compress-context/v2'` | Phase 5 v2 backed by `SmartCompressionEngine`          |

## v2 over v1

- 4-tier preservation (0 = locked, 1 = recent, 2 = mid, 3 = old)
- Tier 0 messages are **never** dropped (CR v7.1 invariant)
- Returns richer metrics: ratio, strategyId, preservedTier0Count, droppedMessageIds, decisionReason
- Wires the engine's hooks (preCompress / postCompress) and metrics

Charter gates: **G15**, **G16 Compress Context v2 Migration**.
