// SPDX-License-Identifier: Apache-2.0
// @gate G33
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  rootTag,
  appendTag,
  verifyChain,
  computeChainHash,
  ProvenanceChainBrokenError,
  type ProvenanceTag,
} from "@orqenix/provenance";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const TOK = "tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

function tag(over: Partial<ProvenanceTag> = {}): Omit<ProvenanceTag, "parentChainHash"> {
  return {
    sourceScopeId: A,
    producedAt: "2026-06-02T00:00:00Z",
    sourceKind: "local",
    ...over,
  } as Omit<ProvenanceTag, "parentChainHash">;
}

class G33 extends GateRunner {
  readonly id = "G33";
  readonly title = "Provenance Chain Integrity";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G33.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G33.1", "provenance unit tests pass", () => {
        execSync("npx vitest run", { cwd: join(REPO_ROOT, "packages/provenance"), stdio: "pipe" });
      }),
      await this.check("G33.2", "100x random chains verify cleanly", () => {
        for (let i = 0; i < 100; i++) {
          let chain = rootTag(
            tag({ sourceScopeId: A, producedAt: new Date(2026, 5, 1, 0, 0, i).toISOString() }),
          );
          const len = 1 + (i % 8);
          for (let j = 0; j < len; j++) {
            chain = appendTag(
              chain,
              tag({
                sourceScopeId: j % 2 === 0 ? B : A,
                sourceKind: j % 2 === 0 ? "mesh" : "distilled",
                tokenJti: j % 2 === 0 ? TOK : undefined,
                producedAt: new Date(2026, 5, 1, 0, 1, i * j).toISOString(),
              }),
            );
          }
          verifyChain(chain);
        }
      }),
      await this.check("G33.3", "50x tampered chains all detected", () => {
        for (let i = 0; i < 50; i++) {
          let chain = rootTag(tag());
          chain = appendTag(chain, tag({ sourceScopeId: B, sourceKind: "mesh", tokenJti: TOK }));
          const tamperedTags = chain.tags.map((t, idx) =>
            idx === 0 ? { ...t, originPath: `tamper-${i}` } : t,
          ) as ProvenanceTag[];
          const tampered = { tags: tamperedTags, chainHash: chain.chainHash };
          let caught = false;
          try {
            verifyChain(tampered);
          } catch (e) {
            caught = e instanceof ProvenanceChainBrokenError;
          }
          if (!caught) throw new Error(`tamper not caught iter ${i}`);
        }
      }),
      await this.check("G33.4", "chainHash is deterministic across runs", () => {
        const chain = rootTag(tag());
        const h1 = computeChainHash(chain.tags);
        for (let i = 0; i < 50; i++) {
          const h2 = computeChainHash(chain.tags);
          if (h1 !== h2) throw new Error(`non-deterministic at iter ${i}`);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G33-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G33();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G33 crashed:", e);
  process.exit(2);
});
