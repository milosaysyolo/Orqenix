import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { TokenVerifier, issueToken } from "@orqenix/capability-tokens";
import { generateKeyPair, deriveScopeId } from "@orqenix/scope-identity";
import {
  ChatStore,
  CHAT_KB_MIGRATIONS,
  createChatVecTable,
  ChatWriteUnauthorizedError,
} from "../src";

describe("ChatStore (verifier-gated writes)", () => {
  let dir: string;
  let conn: SqliteConnection;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-chat-auth-"));
    conn = new SqliteConnection({ path: join(dir, "chat.sqlite"), enableVec: true });
    runMigrations(conn, CHAT_KB_MIGRATIONS);
    createChatVecTable(conn, 4);
  });
  afterEach(async () => {
    conn.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("accepts write with valid write:kb-chat token", async () => {
    const kp = await generateKeyPair();
    const iss = deriveScopeId(kp.publicKey);
    const verifier = new TokenVerifier({
      getIssuerPublicKey: async (kid) => (kid === iss ? kp.publicKey : null),
    });
    const store = new ChatStore({ conn, scopeId: iss, verifier });
    const s = store.createSession({ scopeId: iss, title: "t" });

    const { encoded } = await issueToken({
      issuerScopeId: iss,
      issuerPrivateKey: kp.privateKey,
      subjectScopeId: iss,
      audienceScopeId: iss,
      caps: ["write:kb-chat"],
      ttlSeconds: 60,
    });
    const entry = await store.appendEntry(
      { sessionId: s.sessionId, role: "user", content: "hi", metadata: {} },
      { encodedToken: encoded },
    );
    expect(entry.role).toBe("user");
  });

  it("rejects write with read:kb-chat token only", async () => {
    const kp = await generateKeyPair();
    const iss = deriveScopeId(kp.publicKey);
    const verifier = new TokenVerifier({ getIssuerPublicKey: async () => kp.publicKey });
    const store = new ChatStore({ conn, scopeId: iss, verifier });
    const s = store.createSession({ scopeId: iss, title: "t" });

    const { encoded } = await issueToken({
      issuerScopeId: iss,
      issuerPrivateKey: kp.privateKey,
      subjectScopeId: iss,
      audienceScopeId: iss,
      caps: ["read:kb-chat"],
      ttlSeconds: 60,
    });
    await expect(
      store.appendEntry(
        { sessionId: s.sessionId, role: "user", content: "hi", metadata: {} },
        { encodedToken: encoded },
      ),
    ).rejects.toThrow(ChatWriteUnauthorizedError);
  });

  it("rejects when no token provided to verifier-gated store", async () => {
    const kp = await generateKeyPair();
    const iss = deriveScopeId(kp.publicKey);
    const verifier = new TokenVerifier({ getIssuerPublicKey: async () => kp.publicKey });
    const store = new ChatStore({ conn, scopeId: iss, verifier });
    const s = store.createSession({ scopeId: iss, title: "t" });
    await expect(
      store.appendEntry({ sessionId: s.sessionId, role: "user", content: "hi", metadata: {} }),
    ).rejects.toThrow(ChatWriteUnauthorizedError);
  });
});
