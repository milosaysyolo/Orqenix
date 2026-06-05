// SPDX-License-Identifier: Apache-2.0
// @gate G34
import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.ts";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from "@orqenix/scope-link";
import { rootTag, type ProvenanceChain } from "@orqenix/provenance";
import { MeshRouter, InMemoryMeshTransport, type MeshQueryHit } from "@orqenix/mesh-routing";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const D = "scope:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD";

function prov(sid: string): ProvenanceChain {
  return rootTag({ sourceScopeId: sid, producedAt: "2026-06-02T00:00:00Z", sourceKind: "local" });
}
function hit(sid: string, t: string, s: number): MeshQueryHit {
  return { scopeId: sid, text: t, score: s, provenance: prov(sid) };
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "g34-"));
  const conn = new SqliteConnection({ path: join(dir, "m.sqlite") });
  runMigrations(conn, SCOPE_LINK_MIGRATIONS);
  const linkStore = new ScopeLinkStore({ conn, localScopeId: A });
  const transport = new InMemoryMeshTransport();
  const router = new MeshRouter({ localScopeId: A, linkStore, transport });
  return { dir, conn, linkStore, transport, router };
}
async function tear(dir: string, conn: SqliteConnection) {
  conn.close();
  await new Promise((r) => setTimeout(r, 50));
  await rm(dir, { recursive: true, force: true, maxRetries: 3 });
}
function activate(ls: ScopeLinkStore, r: string) {
  ls.create({ remoteScopeId: r, direction: "outbound" });
  ls.updateStatus(r, "outbound", "active");
}

class G34 extends GateRunner {
  readonly id = "G34";
  readonly title = "Mesh Routing Quorum";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G34.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G34.1", "mesh-routing unit tests pass", () => {
        execSync("npx vitest run", {
          cwd: join(REPO_ROOT, "packages/mesh-routing"),
          stdio: "pipe",
        });
      }),
      await this.check("G34.2", "parallel fanout to all active outbound links", async () => {
        const { dir, conn, linkStore, transport, router } = await setup();
        try {
          activate(linkStore, B);
          activate(linkStore, C);
          transport.setHandler(B, async () => [hit(B, "b", 1)]);
          transport.setHandler(C, async () => [hit(C, "c", 0.9)]);
          const r = await router.query({ text: "q", k: 5, timeoutMs: 1000 });
          if (r.scopesQueried !== 2) throw new Error(`expected 2, got ${r.scopesQueried}`);
          if (r.hits.length !== 2) throw new Error("hits not aggregated");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G34.3", "quorum = ceil(scopesQueried/2)", async () => {
        const { dir, conn, linkStore, transport, router } = await setup();
        try {
          activate(linkStore, B);
          activate(linkStore, C);
          activate(linkStore, D);
          transport.setHandler(B, async () => [hit(B, "b", 1)]);
          transport.setHandler(C, async () => [hit(C, "c", 1)]);
          transport.setHandler(D, () => {
            throw new Error("down");
          });
          const r = await router.query({ text: "q", k: 5, timeoutMs: 1000 });
          if (!r.quorumReached) throw new Error("quorum should reach (2/3)");

          // Now make only 1/3 succeed
          transport.setHandler(C, () => {
            throw new Error("down");
          });
          const r2 = await router.query({ text: "q2", k: 5, timeoutMs: 1000 });
          if (r2.quorumReached) throw new Error("quorum should not reach (1/3)");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G34.4", "timeout outcome recorded per-target", async () => {
        const { dir, conn, linkStore, transport, router } = await setup();
        try {
          activate(linkStore, B);
          transport.setHandler(
            B,
            async () =>
              new Promise((resolve) =>
                setTimeout(() => resolve([hit(B, "late", 1)]), 500),
              ) as Promise<MeshQueryHit[]>,
          );
          const r = await router.query({ text: "q", k: 5, timeoutMs: 100 });
          if (r.outcomes[0].ok) throw new Error("timeout outcome not recorded");
          if (r.outcomes[0].ok === false && r.outcomes[0].reason !== "timeout")
            throw new Error("reason not timeout");
        } finally {
          await tear(dir, conn);
        }
      }),
      await this.check("G34.5", "broken provenance hits dropped silently", async () => {
        const { dir, conn, linkStore, transport, router } = await setup();
        try {
          activate(linkStore, B);
          const tampered = { ...hit(B, "bad", 1) };
          tampered.provenance = { ...tampered.provenance, chainHash: "f".repeat(64) as any };
          transport.setHandler(B, async () => [hit(B, "good", 0.5), tampered]);
          const r = await router.query({ text: "q", k: 5, timeoutMs: 1000 });
          if (r.hits.length !== 1) throw new Error(`expected 1 valid hit, got ${r.hits.length}`);
          if (r.hits[0].text !== "good") throw new Error("wrong hit kept");
        } finally {
          await tear(dir, conn);
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G34-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G34();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G34 crashed:", e);
  process.exit(2);
});
