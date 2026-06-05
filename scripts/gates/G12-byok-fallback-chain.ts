// SPDX-License-Identifier: Apache-2.0
// @gate G12
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { FallbackChain } from "@orqenix/llm-adapter-byok";
import {
  type LlmAdapter,
  type LlmRequest,
  type LlmResponse,
  LlmProviderError,
  LlmRateLimitError,
  LlmAuthError,
  LlmTimeoutError,
} from "@orqenix/llm-adapter-ollama";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

function adapter(name: string, fn: () => Promise<LlmResponse>): LlmAdapter {
  return {
    provider: name,
    model: "mock",
    async complete(_req: LlmRequest): Promise<LlmResponse> {
      return fn();
    },
    async isHealthy() {
      return true;
    },
  };
}

class G12 extends GateRunner {
  readonly id = "G12";
  readonly title = "BYOK Fallback Chain";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G12.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G12.1", "uses first healthy adapter", async () => {
        const chain = new FallbackChain({
          adapters: [
            adapter("a", async () => ({
              content: "A",
              finishReason: "stop",
              tokensIn: 0,
              tokensOut: 0,
              model: "m",
              provider: "a",
              latencyMs: 1,
            })),
            adapter("b", async () => ({
              content: "B",
              finishReason: "stop",
              tokensIn: 0,
              tokensOut: 0,
              model: "m",
              provider: "b",
              latencyMs: 1,
            })),
          ],
        });
        const r = await chain.complete({ messages: [{ role: "user", content: "x" }] });
        if (r.content !== "A") throw new Error("did not pick first");
      }),

      await this.check("G12.2", "falls through LlmProviderError", async () => {
        const chain = new FallbackChain({
          adapters: [
            adapter("a", async () => {
              throw new LlmProviderError("a", "down");
            }),
            adapter("b", async () => ({
              content: "B",
              finishReason: "stop",
              tokensIn: 0,
              tokensOut: 0,
              model: "m",
              provider: "b",
              latencyMs: 1,
            })),
          ],
        });
        const r = await chain.complete({ messages: [{ role: "user", content: "x" }] });
        if (r.content !== "B") throw new Error("did not fall through");
      }),

      await this.check("G12.3", "falls through LlmRateLimitError", async () => {
        const chain = new FallbackChain({
          adapters: [
            adapter("a", async () => {
              throw new LlmRateLimitError("a");
            }),
            adapter("b", async () => ({
              content: "B",
              finishReason: "stop",
              tokensIn: 0,
              tokensOut: 0,
              model: "m",
              provider: "b",
              latencyMs: 1,
            })),
          ],
        });
        const r = await chain.complete({ messages: [{ role: "user", content: "x" }] });
        if (r.content !== "B") throw new Error("did not fall through on rate limit");
      }),

      await this.check("G12.4", "falls through LlmAuthError and LlmTimeoutError", async () => {
        const chain = new FallbackChain({
          adapters: [
            adapter("a", async () => {
              throw new LlmAuthError("a");
            }),
            adapter("b", async () => {
              throw new LlmTimeoutError(100);
            }),
            adapter("c", async () => ({
              content: "C",
              finishReason: "stop",
              tokensIn: 0,
              tokensOut: 0,
              model: "m",
              provider: "c",
              latencyMs: 1,
            })),
          ],
        });
        const r = await chain.complete({ messages: [{ role: "user", content: "x" }] });
        if (r.content !== "C") throw new Error("did not reach 3rd adapter");
      }),

      await this.check("G12.5", "aggregates errors when all fail", async () => {
        const chain = new FallbackChain({
          adapters: [
            adapter("a", async () => {
              throw new LlmProviderError("a", "down");
            }),
            adapter("b", async () => {
              throw new LlmRateLimitError("b");
            }),
          ],
        });
        let caught = false;
        try {
          await chain.complete({ messages: [{ role: "user", content: "x" }] });
        } catch (e) {
          caught =
            e instanceof LlmProviderError && /all 2 adapters failed/.test((e as Error).message);
        }
        if (!caught) throw new Error("expected aggregated LlmProviderError");
      }),

      await this.check("G12.6", "empty chain rejected at construction", () => {
        let caught = false;
        try {
          new FallbackChain({ adapters: [] });
        } catch {
          caught = true;
        }
        if (!caught) throw new Error("empty chain was not rejected");
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G12-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G12();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G12 crashed:", e);
  process.exit(2);
});
