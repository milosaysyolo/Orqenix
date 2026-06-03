// SPDX-License-Identifier: Apache-2.0
// @gate G8
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { OllamaAdapter } from "@orqenix/llm-adapter-ollama";
import {
  OpenAiAdapter,
  AnthropicAdapter,
  GoogleAdapter,
  DeepSeekAdapter,
} from "@orqenix/llm-adapter-byok";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");

class G8 extends GateRunner {
  readonly id = "G8";
  readonly title = "LLM Adapter Contract";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G8.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G8.1", "ollama adapter tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/llm-adapter-ollama"),
          stdio: "pipe",
        });
      }),
      await this.check("G8.2", "byok adapter tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/llm-adapter-byok"),
          stdio: "pipe",
        });
      }),
      await this.check("G8.3", "all 5 adapter classes export LlmAdapter shape", () => {
        for (const cls of [
          OllamaAdapter,
          OpenAiAdapter,
          AnthropicAdapter,
          GoogleAdapter,
          DeepSeekAdapter,
        ]) {
          if (typeof cls !== "function") throw new Error(`adapter is not a class: ${cls}`);
          if (!("prototype" in cls)) throw new Error("missing prototype");
          const proto = (cls as any).prototype;
          for (const m of ["complete", "isHealthy"]) {
            if (typeof proto[m] !== "function")
              throw new Error(`adapter ${cls.name} missing ${m}()`);
          }
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G8-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G8();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G8 crashed:", e);
  process.exit(2);
});
