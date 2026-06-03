// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from "@orqenix/memory-tiers";
import { KeywordRecall, PromptRewriter } from "../src";
import type { LlmAdapter, LlmRequest, LlmResponse } from "@orqenix/llm-adapter-ollama";

const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function fakeAdapter(out: string): LlmAdapter {
  return {
    provider: "fake",
    model: "fake-1",
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      return {
        content: out,
        finishReason: "stop",
        tokensIn: 1,
        tokensOut: 1,
        model: "fake-1",
        provider: "fake",
        latencyMs: 1,
      };
    },
    async isHealthy() {
      return true;
    },
  };
}

describe("PromptRewriter", () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: MemoryTierStore;
  let rewriter: PromptRewriter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-rw-"));
    conn = new SqliteConnection({ path: join(dir, "r.sqlite") });
    runMigrations(conn, MEMORY_TIER_MIGRATIONS);
    store = new MemoryTierStore({ conn, scopeId: SCOPE });
    store.insert({
      tier: "episodic",
      type: "preference",
      content: "I prefer Rust",
      sourceEntryIds: ["ce:1"],
      confidence: 0.9,
      scopeId: SCOPE,
      metadata: {},
    });
    store.insert({
      tier: "episodic",
      type: "decision",
      content: "I decided to use SQLite",
      sourceEntryIds: ["ce:2"],
      confidence: 0.85,
      scopeId: SCOPE,
      metadata: {},
    });
    rewriter = new PromptRewriter({ recall: new KeywordRecall(store, SCOPE) });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("default strategy is B", () => {
    expect(rewriter.getStrategyName()).toBe("B");
  });

  it("rewrite injects memories matching user query", async () => {
    const out = await rewriter.rewrite({
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "What did I decide about SQLite?" },
      ],
    });
    expect(out.injectedMemoryIds.length).toBeGreaterThanOrEqual(1);
    const sys = out.messages.find((m) => m.role === "system");
    expect(sys?.content).toContain("SQLite");
  });

  it("setStrategy switches at runtime", async () => {
    rewriter.setStrategy("C");
    const out = await rewriter.rewrite({
      messages: [{ role: "user", content: "What do I prefer?" }],
    });
    const lastUser = out.messages[out.messages.length - 1];
    expect(lastUser.role).toBe("user");
    expect(lastUser.content).toContain("Rust");
  });

  it("does not call LLM rewrite unless enabled", async () => {
    let called = 0;
    const adapter: LlmAdapter = {
      provider: "count",
      model: "m",
      async complete() {
        called++;
        return {
          content: "x",
          finishReason: "stop",
          tokensIn: 0,
          tokensOut: 0,
          model: "m",
          provider: "count",
          latencyMs: 0,
        };
      },
      async isHealthy() {
        return true;
      },
    };
    const rw = new PromptRewriter({ recall: new KeywordRecall(store, SCOPE), adapter });
    await rw.rewrite({ messages: [{ role: "user", content: "What do I prefer?" }] });
    expect(called).toBe(0);
  });

  it("LLM rewrite consolidates the system message when enabled", async () => {
    const adapter = fakeAdapter("Consolidated: prefers Rust, uses SQLite.");
    const rw = new PromptRewriter({
      recall: new KeywordRecall(store, SCOPE),
      adapter,
      enableRewriteFn: true,
    });
    const out = await rw.rewrite({
      messages: [
        { role: "system", content: "Base instructions" },
        { role: "user", content: "What do I prefer?" },
      ],
    });
    expect(out.rewriteApplied).toBe(true);
    const sys = out.messages.find((m) => m.role === "system");
    expect(sys?.content).toBe("Consolidated: prefers Rust, uses SQLite.");
  });

  it("gracefully degrades when adapter throws", async () => {
    const adapter: LlmAdapter = {
      provider: "bad",
      model: "m",
      async complete() {
        throw new Error("boom");
      },
      async isHealthy() {
        return false;
      },
    };
    const rw = new PromptRewriter({
      recall: new KeywordRecall(store, SCOPE),
      adapter,
      enableRewriteFn: true,
    });
    const out = await rw.rewrite({
      messages: [
        { role: "system", content: "base" },
        { role: "user", content: "rust?" },
      ],
    });
    expect(out.rewriteApplied).toBe(false);
  });
});
