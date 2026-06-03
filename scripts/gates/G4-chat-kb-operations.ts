import { GateRunner, type GateCheck, type GateReport } from "./_gate-runner.js";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import {
  ChatStore,
  CHAT_KB_MIGRATIONS,
  createChatVecTable,
  HashChainBrokenError,
  ChatWriteUnauthorizedError,
} from "@orqenix/kb-chat";
import { TokenVerifier, issueToken } from "@orqenix/capability-tokens";
import { generateKeyPair, deriveScopeId } from "@orqenix/scope-identity";

const REPO_ROOT = resolve(__dirname, "../..");
const REPORT_DIR = join(REPO_ROOT, ".orqenix/gate-reports");
const SCOPE = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

async function freshStore(): Promise<{ store: ChatStore; conn: SqliteConnection; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "g4-"));
  const conn = new SqliteConnection({ path: join(dir, "c.sqlite"), enableVec: true });
  runMigrations(conn, CHAT_KB_MIGRATIONS);
  createChatVecTable(conn, 4);
  const store = new ChatStore({ conn, scopeId: SCOPE });
  return { store, conn, dir };
}

class G4 extends GateRunner {
  readonly id = "G4";
  readonly title = "Chat KB Operations";
  protected loadSpec(): unknown {
    return readFileSync(join(REPO_ROOT, ".orqenix/charter-gates/G4.yaml"), "utf-8");
  }
  protected async runChecks(): Promise<GateCheck[]> {
    return [
      await this.check("G4.1", "append 50 entries and listEntries returns in order", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const s = store.createSession({ scopeId: SCOPE, title: "g4.1" });
          for (let i = 0; i < 50; i++) {
            await store.appendEntry({
              sessionId: s.sessionId,
              role: i % 2 === 0 ? "user" : "assistant",
              content: `msg-${i}`,
              metadata: {},
            });
          }
          const entries = store.listEntries(s.sessionId, { limit: 200 });
          if (entries.length !== 50) throw new Error(`expected 50, got ${entries.length}`);
          for (let i = 0; i < 50; i++) {
            if (entries[i].content !== `msg-${i}`) throw new Error(`order broken at ${i}`);
          }
        } finally {
          conn.close();
          await rm(dir, { recursive: true, force: true });
        }
      }),

      await this.check("G4.2", "verifyHashChain green on untampered chain", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const s = store.createSession({ scopeId: SCOPE, title: "g4.2" });
          for (let i = 0; i < 20; i++) {
            await store.appendEntry({
              sessionId: s.sessionId,
              role: "user",
              content: `m${i}`,
              metadata: {},
            });
          }
          await store.verifyHashChain(s.sessionId);
        } finally {
          conn.close();
          await rm(dir, { recursive: true, force: true });
        }
      }),

      await this.check("G4.3", "verifyHashChain catches tampered content", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const s = store.createSession({ scopeId: SCOPE, title: "g4.3" });
          await store.appendEntry({
            sessionId: s.sessionId,
            role: "user",
            content: "orig",
            metadata: {},
          });
          conn
            .prepare(`UPDATE chat_entries SET content = 'tampered' WHERE session_id = ?`)
            .run(s.sessionId);
          let caught = false;
          try {
            await store.verifyHashChain(s.sessionId);
          } catch (e) {
            caught = e instanceof HashChainBrokenError;
          }
          if (!caught) throw new Error("tamper not caught");
        } finally {
          conn.close();
          await rm(dir, { recursive: true, force: true });
        }
      }),

      await this.check("G4.4", "capability gate: write:kb-chat token accepted", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g4-4-"));
        try {
          const conn = new SqliteConnection({ path: join(dir, "c.sqlite"), enableVec: true });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          createChatVecTable(conn, 4);
          const kp = await generateKeyPair();
          const iss = deriveScopeId(kp.publicKey);
          const verifier = new TokenVerifier({ getIssuerPublicKey: async () => kp.publicKey });
          const store = new ChatStore({ conn, scopeId: iss, verifier });
          const s = store.createSession({ scopeId: iss, title: "g4.4" });
          const { encoded } = await issueToken({
            issuerScopeId: iss,
            issuerPrivateKey: kp.privateKey,
            subjectScopeId: iss,
            audienceScopeId: iss,
            caps: ["write:kb-chat"],
            ttlSeconds: 60,
          });
          await store.appendEntry(
            { sessionId: s.sessionId, role: "user", content: "hi", metadata: {} },
            { encodedToken: encoded },
          );
          conn.close();
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),

      await this.check("G4.5", "capability gate: read-only token rejected", async () => {
        const dir = await mkdtemp(join(tmpdir(), "g4-5-"));
        try {
          const conn = new SqliteConnection({ path: join(dir, "c.sqlite"), enableVec: true });
          runMigrations(conn, CHAT_KB_MIGRATIONS);
          createChatVecTable(conn, 4);
          const kp = await generateKeyPair();
          const iss = deriveScopeId(kp.publicKey);
          const verifier = new TokenVerifier({ getIssuerPublicKey: async () => kp.publicKey });
          const store = new ChatStore({ conn, scopeId: iss, verifier });
          const s = store.createSession({ scopeId: iss, title: "g4.5" });
          const { encoded } = await issueToken({
            issuerScopeId: iss,
            issuerPrivateKey: kp.privateKey,
            subjectScopeId: iss,
            audienceScopeId: iss,
            caps: ["read:kb-chat"],
            ttlSeconds: 60,
          });
          let caught = false;
          try {
            await store.appendEntry(
              { sessionId: s.sessionId, role: "user", content: "hi", metadata: {} },
              { encodedToken: encoded },
            );
          } catch (e) {
            caught = e instanceof ChatWriteUnauthorizedError;
          }
          if (!caught) throw new Error("read-only token was not rejected");
          conn.close();
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      }),

      await this.check("G4.6", "vector search finds nearest entry", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const s = store.createSession({ scopeId: SCOPE, title: "g4.6" });
          const e1 = await store.appendEntry({
            sessionId: s.sessionId,
            role: "user",
            content: "one",
            metadata: {},
          });
          const e2 = await store.appendEntry({
            sessionId: s.sessionId,
            role: "user",
            content: "two",
            metadata: {},
          });
          const e3 = await store.appendEntry({
            sessionId: s.sessionId,
            role: "user",
            content: "three",
            metadata: {},
          });
          store.indexEmbedding(e1.entryId, new Float32Array([1, 0, 0, 0]));
          store.indexEmbedding(e2.entryId, new Float32Array([0, 1, 0, 0]));
          store.indexEmbedding(e3.entryId, new Float32Array([0, 0, 1, 0]));
          const hits = store.searchByEmbedding(new Float32Array([0, 1, 0, 0]), 1);
          if (hits[0].entry.entryId !== e2.entryId) throw new Error("nearest neighbor wrong");
        } finally {
          conn.close();
          await rm(dir, { recursive: true, force: true });
        }
      }),

      await this.check("G4.7", "session cascade delete removes entries", async () => {
        const { store, conn, dir } = await freshStore();
        try {
          const s = store.createSession({ scopeId: SCOPE, title: "g4.7" });
          await store.appendEntry({
            sessionId: s.sessionId,
            role: "user",
            content: "a",
            metadata: {},
          });
          await store.appendEntry({
            sessionId: s.sessionId,
            role: "user",
            content: "b",
            metadata: {},
          });
          conn.prepare(`DELETE FROM chat_sessions WHERE session_id = ?`).run(s.sessionId);
          const left = conn
            .prepare(`SELECT COUNT(*) as c FROM chat_entries WHERE session_id = ?`)
            .get(s.sessionId) as { c: number };
          if (left.c !== 0) throw new Error(`cascade failed, ${left.c} entries left`);
        } finally {
          conn.close();
          await rm(dir, { recursive: true, force: true });
        }
      }),
    ];
  }
  protected writeReport(report: GateReport): void {
    mkdirSync(REPORT_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(REPORT_DIR, `G4-${ts}.json`), JSON.stringify(report, null, 2));
  }
}

async function main(): Promise<void> {
  const r = new G4();
  const rep = await r.execute();
  r.printSummary(rep);
  process.exit(rep.status === "pass" ? 0 : 1);
}
main().catch((e) => {
  console.error("G4 crashed:", e);
  process.exit(2);
});
