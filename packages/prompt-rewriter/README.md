# @orqenix/prompt-rewriter

The orchestrator that combines memory recall + injection strategy + optional LLM rewrite.

## Quick start

```ts
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from "@orqenix/memory-tiers";
import { KeywordRecall, PromptRewriter } from "@orqenix/prompt-rewriter";
import { OllamaAdapter } from "@orqenix/llm-adapter-ollama";

const conn = new SqliteConnection({ path: "./kb.sqlite" });
runMigrations(conn, MEMORY_TIER_MIGRATIONS);
const store = new MemoryTierStore({ conn, scopeId: MY_SCOPE });

const rewriter = new PromptRewriter({
  recall: new KeywordRecall(store, MY_SCOPE),
  strategyName: "B",
  adapter: new OllamaAdapter(),
  enableRewriteFn: false, // pure injection by default
});

const { messages, injectedMemoryIds, strategy } = await rewriter.rewrite({
  messages: [{ role: "user", content: "What did I decide about storage?" }],
});
```

## Recall

OSS ships keyword-based recall (case-insensitive token matching + confidence weighting).
Vector-based recall is a Pro feature in `@orqenix-pro/recall-vector` (Part 11 in the Orqenix-Pro repo).

Charter gates: **G10 Prompt Rewriter Orchestration**, **G11 Memory Recall**.
