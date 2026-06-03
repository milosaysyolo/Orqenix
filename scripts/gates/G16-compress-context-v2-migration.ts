// SPDX-License-Identifier: Apache-2.0
// @gate G16
import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import plugin, { ConfigSchema, createV2Plugin } from "@orqenix/plugin-compress-context";
import {
  DropStrategy,
  DistillStrategy,
  SummarizeStrategy,
  CompressChainStrategy,
} from "@orqenix/compress-strategies";
import { SmartCompressionEngine } from "@orqenix/smart-compression";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

class G16 extends GateRunner {
  readonly id = "G16";
  readonly title = "Compress Context v2 Migration";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G16.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G16.1", "plugin-compress-context unit tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/plugin-compress-context"),
          stdio: "pipe",
        });
      }),

      await this.check("G16.2", "v1 default export shape unchanged (run + ConfigSchema)", () => {
        if (typeof plugin.run !== "function") throw new Error("v1 plugin.run is not a function");
        if (typeof ConfigSchema.safeParse !== "function")
          throw new Error("ConfigSchema is not zod");
      }),

      await this.check("G16.3", "v1 below-threshold passthrough behavior preserved", async () => {
        const r = await plugin.run({ context: [{ role: "user", content: "hi" }], threshold: 1000 });
        if (r.compressed !== false) throw new Error("v1 should not compress below threshold");
      }),

      await this.check(
        "G16.4",
        "v1 above-threshold compression preserved (compressed=true, tokensOut < tokensIn)",
        async () => {
          const msgs = Array.from({ length: 30 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: "x".repeat(120),
          }));
          const r = await plugin.run({ context: msgs, threshold: 200 });
          if (!r.compressed) throw new Error("v1 should compress above threshold");
          if (r.metrics.tokensOut >= r.metrics.tokensIn)
            throw new Error("v1 tokensOut should be less than tokensIn");
        },
      ),

      await this.check(
        "G16.5",
        "v2 path produces richer metrics with tier-0 preservation",
        async () => {
          const engine = new SmartCompressionEngine({
            config: { targetTokens: 50, maxTokens: 500 },
            strategies: {
              drop: new DropStrategy(),
              summarize: new SummarizeStrategy({ localFallback: true }),
              distill: new DistillStrategy({ extract: () => [] }),
              "compress-chain": new CompressChainStrategy({
                distill: new DistillStrategy({ extract: () => [] }),
                summarize: new SummarizeStrategy({ localFallback: true }),
              }),
            },
            scopeId: SCOPE,
          });
          const v2 = createV2Plugin({ engine });
          const r = await v2.run({
            threshold: 50,
            context: [
              { role: "system", content: "core locked" },
              { role: "user", content: "x".repeat(1000) },
              { role: "user", content: "current" },
            ],
          });
          if (r.metrics.preservedTier0Count !== 1)
            throw new Error(`expected 1 tier-0 preserved, got ${r.metrics.preservedTier0Count}`);
          if (!r.metrics.strategyId) throw new Error("v2 missing strategyId");
          if (r.context[0].content !== "core locked")
            throw new Error("tier-0 system message was modified");
        },
      ),

      await this.check("G16.6", "v2 with already-small input is a no-op", async () => {
        const engine = new SmartCompressionEngine({
          config: { targetTokens: 1000, maxTokens: 3000 },
          strategies: {
            drop: new DropStrategy(),
            summarize: new SummarizeStrategy(),
            distill: new DistillStrategy({ extract: () => [] }),
            "compress-chain": new CompressChainStrategy({
              distill: new DistillStrategy({ extract: () => [] }),
              summarize: new SummarizeStrategy(),
            }),
          },
          scopeId: SCOPE,
        });
        const v2 = createV2Plugin({ engine });
        const r = await v2.run({ threshold: 1000, context: [{ role: "user", content: "hi" }] });
        if (r.compressed !== false) throw new Error("v2 should not compress when under target");
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G16-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G16();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G16 crashed:", e);
  process.exit(2);
});
