// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import {
  AuditLogStore,
  AUDIT_LOG_MIGRATIONS,
  AuditChainBrokenError,
  AuditEntryInvalidError,
} from "../src";

const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("AuditLogStore", () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: AuditLogStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-al-"));
    conn = new SqliteConnection({ path: join(dir, "al.sqlite") });
    runMigrations(conn, AUDIT_LOG_MIGRATIONS);
    store = new AuditLogStore({ conn, scopeId: A });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("first entry has prevHash null", () => {
    const e = store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    expect(e.prevHash).toBeNull();
    expect(e.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("second entry chains to first", () => {
    const e1 = store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    const e2 = store.append({ actorScopeId: A, eventKind: "link_created", payload: { remote: B } });
    expect(e2.prevHash).toBe(e1.contentHash);
  });

  it("verifyChain passes on untampered log", () => {
    for (let i = 0; i < 20; i++) {
      store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: { i } });
    }
    expect(store.verifyChain()).toEqual({ ok: true, entriesChecked: 20 });
  });

  it("verifyChain detects tampered payload", () => {
    store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    store.append({ actorScopeId: A, eventKind: "link_created", payload: { remote: B } });
    conn
      .prepare(`UPDATE audit_log_entries SET payload_json = '{"tampered":true}' WHERE rowid = 2`)
      .run();
    expect(() => store.verifyChain()).toThrow(AuditChainBrokenError);
  });

  it("verifyChain detects broken prevHash linkage", () => {
    store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    store.append({ actorScopeId: A, eventKind: "link_created", payload: { remote: B } });
    conn
      .prepare(`UPDATE audit_log_entries SET prev_hash = '${"f".repeat(64)}' WHERE rowid = 2`)
      .run();
    expect(() => store.verifyChain()).toThrow(AuditChainBrokenError);
  });

  it("list filters by event kind", () => {
    store.append({ actorScopeId: A, eventKind: "link_created", payload: {} });
    store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: {} });
    store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: {} });
    expect(store.list({ kind: "mesh_query_run" }).length).toBe(2);
    expect(store.list({ kind: "link_created" }).length).toBe(1);
  });

  it("list returns entries in rowid order", () => {
    for (let i = 0; i < 5; i++) {
      store.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: { i } });
    }
    const list = store.list({});
    for (let i = 1; i < list.length; i++) {
      expect(list[i].rowid).toBeGreaterThan(list[i - 1].rowid);
    }
  });

  it("count returns number of entries for scope", () => {
    expect(store.count()).toBe(0);
    store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    store.append({ actorScopeId: A, eventKind: "link_created", payload: {} });
    expect(store.count()).toBe(2);
  });

  it("getByContentHash returns the entry", () => {
    const e = store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    expect(store.getByContentHash(e.contentHash)?.rowid).toBe(e.rowid);
    expect(store.getByContentHash("0".repeat(64))).toBeNull();
  });

  it("verifyEntry throws on tampered single row", () => {
    const e = store.append({ actorScopeId: A, eventKind: "scope_initialized", payload: { x: 1 } });
    conn
      .prepare(`UPDATE audit_log_entries SET payload_json = '{"x":2}' WHERE rowid = ?`)
      .run(e.rowid);
    expect(() => store.verifyEntry(e.rowid)).toThrow(AuditEntryInvalidError);
  });

  it("two scopes have independent chains", () => {
    const storeA = store;
    const storeB = new AuditLogStore({ conn, scopeId: B });
    storeA.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    storeB.append({ actorScopeId: B, eventKind: "scope_initialized", payload: {} });
    storeA.append({ actorScopeId: A, eventKind: "mesh_query_run", payload: {} });
    storeB.append({ actorScopeId: B, eventKind: "mesh_query_run", payload: {} });
    expect(storeA.verifyChain().entriesChecked).toBe(2);
    expect(storeB.verifyChain().entriesChecked).toBe(2);
  });
});
