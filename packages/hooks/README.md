# @orqenix/hooks

Typed event bus for Orqenix compress / distill / recall / inject lifecycle.

## 7 hook events

| Event | Fired by | Payload |
|-------|----------|---------|
| `preCompress` | Smart Compression Engine | `{ inputTokens, contextSize, strategyId }` |
| `postCompress` | Smart Compression Engine | `{ inputTokens, outputTokens, ratio, strategyId, preservedTier0Count, durationMs }` |
| `preDistill` | Memory Distiller Worker | `{ batchSize }` |
| `postDistill` | Memory Distiller Worker | `{ entriesScanned, memoriesCreated, durationMs }` |
| `preRecall` | Prompt Rewriter | `{ query, k }` |
| `postRecall` | Prompt Rewriter | `{ query, memoryIdsReturned, durationMs }` |
| `preInject` | Prompt Rewriter | `{ strategyName, memoryCount }` |

## Listener isolation

Errors in one listener never block other listeners or the emit caller. Wire `onError` to capture them.

```ts
import { HookBus } from '@orqenix/hooks';

const bus = new HookBus();
bus.onError((event, err) => console.error(`hook ${event} error`, err));
bus.on('postCompress', (p) => console.log(`compressed to ${p.ratio * 100}%`));
```

Charter gate: **G14 Hooks**.
