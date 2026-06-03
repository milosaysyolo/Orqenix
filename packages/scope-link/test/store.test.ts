// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import {
  ScopeLinkStore,
  SCOPE_LINK_MIGRATIONS,
  LinkAlreadyExistsError,
  LinkNotFoundError,
  LinkStateError,
} from "../src";

const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

describe("ScopeLinkStore", () => {
  let dir: string;
  let conn: SqliteConnection;
  let store: ScopeLinkStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-sl-"));
    conn = new SqliteConnection({ path: join(dir, "sl.sqlite") });
    runMigrations(conn, SCOPE_LINK_MIGRATIONS);
    store = new ScopeLinkStore({ conn, localScopeId: A });
  });
  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("creates an outbound link", () => {
    const l = store.create({ remoteScopeId: B, direction: "outbound", displayName: "partner" });
    expect(l.status).toBe("pending");
    expect(l.displayName).toBe("partner");
    expect(store.count()).toBe(1);
  });

  it("rejects duplicate (local, remote, direction)", () => {
    store.create({ remoteScopeId: B, direction: "outbound" });
    expect(() => store.create({ remoteScopeId: B, direction: "outbound" })).toThrow(
      LinkAlreadyExistsError,
    );
  });

  it("allows same (local, remote) with different direction", () => {
    store.create({ remoteScopeId: B, direction: "outbound" });
    store.create({ remoteScopeId: B, direction: "inbound" });
    expect(store.count()).toBe(2);
  });

  it("rejects self-link", () => {
    expect(() => store.create({ remoteScopeId: A, direction: "outbound" })).toThrow();
  });

  it("get throws LinkNotFoundError when missing", () => {
    expect(() => store.get(B, "outbound")).toThrow(LinkNotFoundError);
    expect(store.tryGet(B, "outbound")).toBeNull();
  });

  it("list filters by status + direction", () => {
    store.create({ remoteScopeId: B, direction: "outbound", status: "pending" });
    store.create({ remoteScopeId: C, direction: "outbound", status: "pending" });
    store.updateStatus(C, "outbound", "active");
    expect(store.list({ status: "pending" }).length).toBe(1);
    expect(store.list({ status: "active" }).length).toBe(1);
    expect(store.list({ direction: "inbound" }).length).toBe(0);
  });

  it("updateStatus enforces legal transitions", () => {
    store.create({ remoteScopeId: B, direction: "outbound" });
    store.updateStatus(B, "outbound", "active");
    expect(store.get(B, "outbound").lastSyncedAt).toBeDefined();
    store.updateStatus(B, "outbound", "revoked");
    expect(store.get(B, "outbound").status).toBe("revoked");
    expect(() => store.updateStatus(B, "outbound", "active")).toThrow(LinkStateError);
    expect(() => store.updateStatus(B, "outbound", "pending")).toThrow(LinkStateError);
  });

  it("recordSync requires active state", () => {
    store.create({ remoteScopeId: B, direction: "outbound" });
    expect(() => store.recordSync(B, "outbound")).toThrow(LinkStateError);
    store.updateStatus(B, "outbound", "active");
    const after = store.recordSync(B, "outbound");
    expect(after.lastSyncedAt).toBeDefined();
  });

  it("remove returns true only when row existed", () => {
    store.create({ remoteScopeId: B, direction: "outbound" });
    expect(store.remove(B, "outbound")).toBe(true);
    expect(store.remove(B, "outbound")).toBe(false);
  });

  it("updateStatus accepts new capabilityTokenJti", () => {
    store.create({ remoteScopeId: B, direction: "outbound" });
    const updated = store.updateStatus(B, "outbound", "active", {
      tokenJti: "tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
    });
    expect(updated.capabilityTokenJti).toBe("tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD");
  });
});
