// SPDX-License-Identifier: Apache-2.0
// @gate G35
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from "@orqenix/scope-link";
import { rootTag, type ProvenanceChain } from "@orqenix/provenance";
import {
  MeshRouter,
  InMemoryMeshTransport,
  type MeshQueryHit,
  type MeshQueryResponse,
} from "@orqenix/mesh-routing";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

function prov(sid: string): ProvenanceChain {
  return rootTag({ sourceScopeId: sid, producedAt: "2026-06-02T00:00:00Z", sourceKind: "local" });
}
function hit(sid: string, t: string, s: number): MeshQueryHit {
  return { scopeId: sid, text: t, score: s, provenance: prov(sid) };
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "g35-"));
  const conn = new SqliteConnection({ path: join(dir, "m.sqlite") });
  runMigrations(conn, SCOPE_LINK_MIGRATIONS);
  const linkStore = new ScopeLinkStore({ conn, localScopeId: A });
  return {
    dir,
    conn,
    router: new MeshRouter({ localScopeId: A, linkStore, transport: new InMemoryMeshTransport() }),
  };
}
async function tear(dir: string, conn: SqliteConnection) {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}

function failureResponse(sid: string): MeshQueryResponse {
  return {
    query: { text: "q", k: 5, timeoutMs: 1000 } as any,
    scopesQueried: 1,
    scopesSucceeded: 0,
    hits: [],
    outcomes: [
      { scopeId: sid, ok: false, reason: "timeout", message: "t", durationMs: 100 } as any,
    ],
    totalDurationMs: 100,
    quorumReached: false,
  };
}
function successResponse(sid: string, score: number): MeshQueryResponse {
  return {
    query: { text: "q", k: 5, timeoutMs: 1000 } as any,
    scopesQueried: 1,
    scopesSucceeded: 1,
    hits: [hit(sid, "h", score)],
    outcomes: [{ scopeId: sid, ok: true, hits: [hit(sid, "h", score)], durationMs: 10 } as any],
    totalDurationMs: 10,
    quorumReached: true,
  };
}

class G35 extends GateRunner {
  readonly id = "G35";
  readonly title = "Auto-Link Suggestion";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G35.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check(
        "G35.1",
        "frequent-failure suggestion at >=60% failure rate over >=5 runs",
        async () => {
          const { dir, conn, router } = await setup();
          try {
            const history: MeshQueryResponse[] = [];
            for (let i = 0; i < 5; i++) history.push(failureResponse(B));
            const s = router.suggestLinks(history);
            if (!s.some((x) => x.reason === "frequent-failure" && x.scopeId === B)) {
              throw new Error("frequent-failure not detected");
            }
          } finally {
            await tear(dir, conn);
          }
        },
      ),
      await this.check("G35.2", "high-relevance suggestion for top-quartile scopes", async () => {
        const { dir, conn, router } = await setup();
        try {
          const history: MeshQueryResponse[] = [];
          for (let i = 0; i < 4; i++) {
            history.push({
              query: { text: "q", k: 5, timeoutMs: 1000 } as any,
              scopesQueried: 2,
              scopesSucceeded: 2,
              hits: [],
              outcomes: [
                { scopeId: B, ok: true, hits: [hit(B, "top", 0.95)], durationMs: 10 } as any,
                { scopeId: C, ok: true, hits: [hit(C, "low", 0.2)], durationMs: 10 } as any,
              ],
              totalDurationMs: 10,
              quorumReached: true,
            });
          }
          const s = router.suggestLinks(history);
          if (!s.some((x) => x.reason === "high-relevance" && x.scopeId === B)) {
            throw new Error("high-relevance not detected");
          }
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G35.3", "no suggestion under sample-size floor", async () => {
        const { dir, conn, router } = await setup();
        try {
          const history = [failureResponse(B), failureResponse(B)]; // only 2 runs
          const s = router.suggestLinks(history);
          if (s.some((x) => x.reason === "frequent-failure")) {
            throw new Error("false positive on insufficient sample");
          }
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G35.4", "empty history returns empty suggestions", async () => {
        const { dir, conn, router } = await setup();
        try {
          if (router.suggestLinks([]).length !== 0)
            throw new Error("non-empty result for empty history");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check(
        "G35.5",
        "high-failure scope is NOT suggested as high-relevance",
        async () => {
          const { dir, conn, router } = await setup();
          try {
            const history: MeshQueryResponse[] = [];
            for (let i = 0; i < 5; i++) history.push(failureResponse(B));
            for (let i = 0; i < 4; i++) history.push(successResponse(B, 0.99));
            const s = router.suggestLinks(history);
            const failureFound = s.some((x) => x.reason === "frequent-failure" && x.scopeId === B);
            const relevanceFound = s.some((x) => x.reason === "high-relevance" && x.scopeId === B);
            if (failureFound && relevanceFound)
              throw new Error("conflicting recommendations for same scope");
          } finally {
            await tear(dir, conn);
          }
        },
      ),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G35-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G35();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G35 crashed:", e);
  process.exit(2);
});
