import { hashString } from "@orqenix/core";
import type { OrqenixPlugin } from "@orqenix/core/plugin";

interface CacheEntry {
  call: { model: string; messages: { role: string; content: string }[] };
  response: { content: string; tokens: { input: number; output: number } };
  hits: number;
  createdAt: number;
}

class SemanticCache {
  private store = new Map<string, CacheEntry>();
  private maxSize = 500;

  key(call: { model: string; messages: { role: string; content: string }[] }): string {
    const normalized = JSON.stringify({
      m: call.model,
      h: call.messages.map((x) => ({ r: x.role, c: x.content.trim() })),
    });
    return hashString(normalized);
  }

  get(call: { model: string; messages: { role: string; content: string }[] }) {
    const k = this.key(call);
    const entry = this.store.get(k);
    if (!entry) return null;
    entry.hits++;
    return entry.response;
  }

  set(
    call: { model: string; messages: { role: string; content: string }[] },
    response: { content: string; tokens: { input: number; output: number } },
  ): void {
    if (this.store.size >= this.maxSize) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
      if (oldest) this.store.delete(oldest[0]);
    }
    this.store.set(this.key(call), {
      call,
      response,
      hits: 0,
      createdAt: Date.now(),
    });
  }

  stats() {
    let totalHits = 0;
    for (const e of this.store.values()) totalHits += e.hits;
    return { size: this.store.size, totalHits };
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new SemanticCache();

export const plugin: OrqenixPlugin = {
  name: "semantic-cache",
  version: "0.2.0-dev",
  description: "Exact-match LLM call cache (in-memory, per session)",
  priority: 60,
  capabilities: ["caching", "cost-savings"],
  hooks: {
    "llm.call.after": async (call, response, ctx) => {
      cache.set(
        { model: call.model, messages: call.messages },
        { content: response.content, tokens: response.tokens },
      );
      ctx.log.debug("semantic-cache: stored", { size: cache.stats().size });
    },
  },
};

export default plugin;
