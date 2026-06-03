// SPDX-License-Identifier: Apache-2.0
// @gate G10
import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { MemoryTierStore, MEMORY_TIER_MIGRATIONS } from "@orqenix/memory-tiers";
import { KeywordRecall, PromptRewriter } from "@orqenix/prompt-rewriter";
import type { LlmAdapter, LlmRequest, LlmResponse } from "@orqenix/llm-adapter-ollama";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function freshStore(): Promise<{
  store: MemoryTierStore;
  conn: SqliteConnection;
  dir: string;
}> {
  const dir = await mkdtemp(join(tmpdir(), "g10-"));
  const conn = new SqliteConnection({ path: join(dir, "r.sqlite") });
  runMigrations(conn, MEMORY_TIER_MIGRATIONS);
  const store = new MemoryTierStore({ conn, scopeId: SCOPE });
  return { store, conn, dir };
}

async function cleanup(conn: SqliteConnection, dir: string): Promise<void> {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

function fakeAdapter(content: string, counter?: { n: number }): LlmAdapter {
  return {
    provider: "fake",
    model: "fake-1",
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      if (counter) counter.n++;
      return {
        content,
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

class G10 extends GateRunner {
  readonly id = "G10";
  readonly title = "Prompt Rewriter Orchestration";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G10.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G10.1", "prompt-rewriter unit tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/prompt-rewriter"),
          stdio: "pipe",
        });
      }),

      await this.check("G10.2", "default strategy is B", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const rw = new PromptRewriter({ recall: new KeywordRecall(store, SCOPE) });
          if (rw.getStrategyName() !== "B")
            throw new Error(`default is ${rw.getStrategyName()}, expected B`);
        } finally {
          await cleanup(conn, dir);
        }
      }),

      await this.check("G10.3", "rewrite injects matching memories", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          store.insert({
            tier: "episodic",
            type: "decision",
            content: "I decided to use SQLite for storage",
            sourceEntryIds: ["ce:1"],
            confidence: 0.9,
            scopeId: SCOPE,
            metadata: {},
          });
          const rw = new PromptRewriter({ recall: new KeywordRecall(store, SCOPE) });
          const out = await rw.rewrite({
            messages: [{ role: "user", content: "What did I decide about storage?" }],
          });
          if (out.injectedMemoryIds.length === 0)
            throw new Error("expected at least 1 injected memory");
          const sys = out.messages.find((m) => m.role === "system");
          if (!sys || !sys.content.includes("SQLite"))
            throw new Error("system block missing memory");
        } finally {
          await cleanup(conn, dir);
        }
      }),

      await this.check("G10.4", "setStrategy switches at runtime", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const rw = new PromptRewriter({ recall: new KeywordRecall(store, SCOPE) });
          rw.setStrategy("D");
          if (rw.getStrategyName() !== "D") throw new Error("switch failed");
        } finally {
          await cleanup(conn, dir);
        }
      }),

      await this.check("G10.5", "rewriteFn not invoked unless enabled", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const counter = { n: 0 };
          const rw = new PromptRewriter({
            recall: new KeywordRecall(store, SCOPE),
            adapter: fakeAdapter("x", counter),
          });
          await rw.rewrite({ messages: [{ role: "user", content: "q" }] });
          if (counter.n !== 0) throw new Error(`adapter called ${counter.n} times, expected 0`);
        } finally {
          await cleanup(conn, dir);
        }
      }),

      await this.check("G10.6", "rewriteFn consolidates system message when enabled", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const rw = new PromptRewriter({
            recall: new KeywordRecall(store, SCOPE),
            adapter: fakeAdapter("CONSOLIDATED OUTPUT"),
            enableRewriteFn: true,
          });
          const out = await rw.rewrite({
            messages: [
              { role: "system", content: "base instructions" },
              { role: "user", content: "q" },
            ],
          });
          if (!out.rewriteApplied) throw new Error("rewrite was not applied");
          const sys = out.messages.find((m) => m.role === "system");
          if (sys?.content !== "CONSOLIDATED OUTPUT")
            throw new Error(`expected consolidated, got ${sys?.content}`);
        } finally {
          await cleanup(conn, dir);
        }
      }),

      await this.check(
        "G10.7",
        "adapter failure gracefully degrades (rewriteApplied=false)",
        async () => {
          const { store, conn, dir } = await freshStore();
          try {
            const badAdapter: LlmAdapter = {
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
              adapter: badAdapter,
              enableRewriteFn: true,
            });
            const out = await rw.rewrite({
              messages: [
                { role: "system", content: "sys" },
                { role: "user", content: "q" },
              ],
            });
            if (out.rewriteApplied) throw new Error("should not be applied on adapter failure");
          } finally {
            await cleanup(conn, dir);
          }
        },
      ),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G10-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G10();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G10 crashed:", e);
  process.exit(2);
});
