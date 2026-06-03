// SPDX-License-Identifier: Apache-2.0
// @gate G9
import { GateRunner, type GateCheck, type GateReport } from "@orqenix/gate-runner-core";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { STRATEGIES, DEFAULT_STRATEGY } from "@orqenix/injection-strategies";
import type { MemoryEntry } from "@orqenix/memory-tiers";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

function mkMem(
  i: number,
  tier: "working" | "episodic" | "semantic" | "procedural",
  text: string,
  confidence = 0.8,
): MemoryEntry {
  return {
    id: `mem:${String(i).padStart(2, "0").padEnd(32, "A")}` as any,
    tier,
    type: "fact",
    content: text,
    contentHash: "0".repeat(64),
    sourceEntryIds: ["ce:1"],
    confidence,
    createdAt: "2026-01-01T00:00:00Z",
    lastAccessedAt: "2026-01-01T00:00:00Z",
    accessCount: 0,
    scopeId: "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    metadata: {},
  };
}

class G9 extends GateRunner {
  readonly id = "G9";
  readonly title = "Injection Strategies";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G9.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G9.1", "injection-strategies unit tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/injection-strategies"),
          stdio: "pipe",
        });
      }),

      await this.check("G9.2", "all 5 strategies registered (A/B/C/D/E)", () => {
        const names = Object.keys(STRATEGIES).sort();
        if (names.join(",") !== "A,B,C,D,E")
          throw new Error(`expected A..E, got ${names.join(",")}`);
        for (const k of names) {
          if (STRATEGIES[k as keyof typeof STRATEGIES].name !== k) {
            throw new Error(
              `strategy ${k} reports name ${STRATEGIES[k as keyof typeof STRATEGIES].name}`,
            );
          }
        }
      }),

      await this.check("G9.3", "default strategy is B (System Prologue Tiered)", () => {
        if (DEFAULT_STRATEGY.name !== "B")
          throw new Error(`default is ${DEFAULT_STRATEGY.name}, expected B`);
      }),

      await this.check("G9.4", "B excludes semantic+procedural from system block", () => {
        const out = STRATEGIES.B.apply({
          messages: [
            { role: "system", content: "base" },
            { role: "user", content: "q" },
          ],
          memories: [
            mkMem(1, "working", "tier W"),
            mkMem(2, "episodic", "tier E"),
            mkMem(3, "semantic", "tier S"),
            mkMem(4, "procedural", "tier P"),
          ],
        });
        const sys = out.messages[0].content;
        if (!sys.includes("tier W")) throw new Error("B must include working");
        if (!sys.includes("tier E")) throw new Error("B must include episodic");
        if (sys.includes("tier S") || sys.includes("tier P"))
          throw new Error("B must exclude semantic/procedural");
      }),

      await this.check("G9.5", "C annotates the last user message", () => {
        const out = STRATEGIES.C.apply({
          messages: [{ role: "user", content: "what?" }],
          memories: [mkMem(1, "working", "I prefer Rust")],
        });
        const lastUser = out.messages[out.messages.length - 1];
        if (lastUser.role !== "user") throw new Error("last message is not user");
        if (!lastUser.content.includes("I prefer Rust")) throw new Error("C did not inline memory");
        if (!lastUser.content.includes("what?")) throw new Error("C dropped original question");
      }),

      await this.check("G9.6", "D injects assistant recall turn BEFORE the user message", () => {
        const out = STRATEGIES.D.apply({
          messages: [
            { role: "system", content: "sys" },
            { role: "user", content: "q" },
          ],
          memories: [mkMem(1, "working", "context X")],
        });
        const idxUser = out.messages.findIndex((m) => m.content === "q");
        if (idxUser < 1) throw new Error("user message missing");
        if (out.messages[idxUser - 1].role !== "assistant")
          throw new Error("D did not insert assistant recall before user");
      }),

      await this.check("G9.7", "E ranks by confidence descending", () => {
        const out = STRATEGIES.E.apply({
          messages: [{ role: "user", content: "q" }],
          memories: [
            mkMem(1, "working", "low", 0.3),
            mkMem(2, "working", "high", 0.95),
            mkMem(3, "working", "mid", 0.6),
          ],
          k: 2,
        });
        if (out.injectedMemoryIds.length !== 2)
          throw new Error(`expected 2 injected, got ${out.injectedMemoryIds.length}`);
        const sys = out.messages[0].content;
        if (!sys.includes("high") || !sys.includes("mid")) throw new Error("E did not pick top-2");
        if (sys.includes("low"))
          throw new Error("E should not include low-confidence below cutoff");
      }),

      await this.check("G9.8", "all 5 strategies respect tokenBudget", () => {
        const big = Array.from({ length: 200 }, (_, i) =>
          mkMem(i, "working", `payload ${i} ` + "x".repeat(120)),
        );
        for (const s of Object.values(STRATEGIES)) {
          const out = s.apply({
            messages: [{ role: "user", content: "q" }],
            memories: big,
            tokenBudget: 200,
            k: 50,
          });
          if (out.tokensUsed > 240) throw new Error(`${s.name} exceeded budget: ${out.tokensUsed}`);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G9-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G9();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G9 crashed:", e);
  process.exit(2);
});
