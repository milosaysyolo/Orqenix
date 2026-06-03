# @orqenix/memory-distiller

OSS memory distiller for Orqenix (CR v7.1 Chapter 10, OSS tier).

Heuristic extraction from chat entries, idempotent by `content_hash`, with a background worker that respects a configurable CPU cap (default 20%).

## Quick start

```ts
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ChatStore, CHAT_KB_MIGRATIONS } from "@orqenix/kb-chat";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from "@orqenix/memory-tiers";
import { HeuristicDistiller, DistillerWorker } from "@orqenix/memory-distiller";

const conn = new SqliteConnection({ path: "./kb.sqlite" });
runMigrations(conn, CHAT_KB_MIGRATIONS);
runMigrations(conn, MEMORY_TIER_MIGRATIONS);

const memStore = new MemoryTierStore({ conn, scopeId: MY_SCOPE });
const distiller = new HeuristicDistiller({ memStore, chatConn: conn, scopeId: MY_SCOPE });

const worker = new DistillerWorker({ distiller, cpuLimitPercent: 20 });
worker.on("batch", (stats) => console.log("batch", stats));
worker.on("idle", () => console.log("caught up"));
await worker.start();
```

## What gets extracted

13 patterns across 8 types:

| Confidence | Examples                                            |
| ---------- | --------------------------------------------------- |
| 0.85+      | "I prefer", "decided to", "I learned", "TODO:"      |
| 0.7        | "should use", "need to", "the way to", "works with" |
| 0.55       | "maybe", "might want to", "noticed", "the X is Y"   |

Fallback: if no pattern fires but `inferTypeFromContent` recognizes a type other than `observation`, a low-confidence candidate is created.

## Boundary with Pro

The OSS distiller is heuristic only (regex + keyword patterns + tier rules). The Pro tier (`@orqenix-pro/memory-distiller-llm`, shipped in Part 11 in the separate Orqenix-Pro repo) adds LLM-based 13-type structured extraction with multi-pass verification. Both share the same `MemoryTierStore` schema, so memories distilled by either are interoperable.

Charter gates: **G5 Distiller Behavior**, **G7 Background CPU Throttling**.
