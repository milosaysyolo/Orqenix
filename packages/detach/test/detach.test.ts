// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection, runMigrations } from "@orqenix/storage-sqlite";
import { ScopeLinkStore, SCOPE_LINK_MIGRATIONS } from "@orqenix/scope-link";
import { WorkspaceStore, WORKSPACE_MIGRATIONS } from "@orqenix/workspace";
import { AuditLogStore, AUDIT_LOG_MIGRATIONS } from "@orqenix/audit-log";
import { DetachPlanner, DetachExecutor, InvalidConfirmationError } from "../src";

const A = "scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const C = "scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

describe("Detach (planner + executor)", () => {
  let dir: string;
  let conn: SqliteConnection;
  let linkStore: ScopeLinkStore;
  let workspaceStore: WorkspaceStore;
  let auditStore: AuditLogStore;
  let planner: DetachPlanner;
  let executor: DetachExecutor;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "orqenix-detach-"));
    conn = new SqliteConnection({ path: join(dir, "d.sqlite") });
    runMigrations(conn, [
      ...SCOPE_LINK_MIGRATIONS,
      ...WORKSPACE_MIGRATIONS,
      ...AUDIT_LOG_MIGRATIONS,
    ]);
    linkStore = new ScopeLinkStore({ conn, localScopeId: A });
    workspaceStore = new WorkspaceStore({ conn });
    auditStore = new AuditLogStore({ conn, scopeId: A });
    planner = new DetachPlanner({ localScopeId: A, linkStore, workspaceStore, auditStore });
    executor = new DetachExecutor({
      localScopeId: A,
      linkStore,
      workspaceStore,
      auditStore,
      rootDir: dir,
    });
  });

  afterEach(async () => {
    conn.close();
    await new Promise((r) => setTimeout(r, 50));
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("planUnlink reports affected links", () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    linkStore.create({ remoteScopeId: B, direction: "inbound" });
    linkStore.updateStatus(B, "inbound", "active");
    linkStore.create({ remoteScopeId: C, direction: "outbound" }); // not affected

    const plan = planner.planUnlink(B);
    expect(plan.kind).toBe("unlink-remote");
    expect(plan.targetScopeId).toBe(B);
    expect(plan.affectedLinks).toBe(2);
    expect(plan.confirmationToken).toMatch(/^detach:[A-Z2-7]{32}$/);
  });

  it("execute(unlink, valid token) revokes both directions", async () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    linkStore.create({ remoteScopeId: B, direction: "inbound" });
    linkStore.updateStatus(B, "inbound", "active");

    const plan = planner.planUnlink(B);
    const report = await executor.execute(plan, plan.confirmationToken);
    expect(report.executedAt).toBeDefined();
    expect(linkStore.get(B, "outbound").status).toBe("revoked");
    expect(linkStore.get(B, "inbound").status).toBe("revoked");
  });

  it("execute rejects mismatched confirmation token", async () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    const plan = planner.planUnlink(B);
    await expect(executor.execute(plan, "detach:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ")).rejects.toThrow(
      InvalidConfirmationError,
    );
    expect(linkStore.get(B, "outbound").status).toBe("active");
  });

  it("execute rejects plan from a different localScopeId", async () => {
    const plan = planner.planUnlink(B);
    const tamperedPlan = { ...plan, localScopeId: C };
    await expect(executor.execute(tamperedPlan, plan.confirmationToken)).rejects.toThrow(
      InvalidConfirmationError,
    );
  });

  it("dryRun does not mutate links but records audit entry", async () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    const before = auditStore.count();
    const plan = planner.planUnlink(B);
    await executor.execute(plan, plan.confirmationToken, { dryRun: true });
    expect(linkStore.get(B, "outbound").status).toBe("active");
    expect(auditStore.count()).toBe(before + 1);
    const lastEntry = auditStore.list({ kind: "scope_detached" }).pop();
    expect(lastEntry?.payload).toMatchObject({ dryRun: true });
  });

  it("full-detach revokes all active links + deletes owned workspaces", async () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    linkStore.create({ remoteScopeId: C, direction: "outbound" });
    linkStore.updateStatus(C, "outbound", "active");
    const w = workspaceStore.create({ name: "team-a", ownerScopeId: A });

    await mkdir(join(dir, ".orqenix"), { recursive: true });
    await writeFile(join(dir, ".orqenix", "identity.key"), "PEM");
    await writeFile(join(dir, ".orqenix", "scope.yaml"), "name: x");
    await writeFile(join(dir, ".orqenix", "audit.bin"), "data");

    const plan = planner.planFullDetach();
    expect(plan.affectedLinks).toBeGreaterThanOrEqual(2);

    const report = await executor.execute(plan, plan.confirmationToken);
    expect(report.kind).toBe("full-detach");
    expect(linkStore.get(B, "outbound").status).toBe("revoked");
    expect(linkStore.get(C, "outbound").status).toBe("revoked");
    expect(() => workspaceStore.get(w.id as any)).toThrow();

    const state = await executor.checkDirState(dir);
    expect(state.hasIdentityKey).toBe(true);
    expect(state.otherEntryCount).toBe(0);
  });

  it("full-detach without preserveIdentityKey removes everything", async () => {
    await mkdir(join(dir, ".orqenix"), { recursive: true });
    await writeFile(join(dir, ".orqenix", "identity.key"), "PEM");
    await writeFile(join(dir, ".orqenix", "scope.yaml"), "x");
    const plan = planner.planFullDetach();
    await executor.execute(plan, plan.confirmationToken, { preserveIdentityKey: false });
    const state = await executor.checkDirState(dir);
    expect(state.hasIdentityKey).toBe(false);
    expect(state.otherEntryCount).toBe(0);
  });

  it("detach event chained into audit log + verifyChain passes", async () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    auditStore.append({ actorScopeId: A, eventKind: "scope_initialized", payload: {} });
    auditStore.append({ actorScopeId: A, eventKind: "link_created", payload: { remote: B } });
    const plan = planner.planUnlink(B);
    const report = await executor.execute(plan, plan.confirmationToken);
    expect(report.verifierChainHash).toMatch(/^[a-f0-9]{64}$/);
    expect(auditStore.verifyChain()).toEqual({ ok: true, entriesChecked: 3 });
    const last = auditStore.list({ kind: "scope_detached" });
    expect(last).toHaveLength(1);
    expect(last[0].contentHash).toBe(report.verifierChainHash);
  });

  it("confirmation tokens differ across plans (salt randomness)", () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    const p1 = planner.planUnlink(B);
    const p2 = planner.planUnlink(B);
    expect(p1.confirmationToken).not.toBe(p2.confirmationToken);
  });

  it("replay attack: cannot reuse token for a different plan", async () => {
    linkStore.create({ remoteScopeId: B, direction: "outbound" });
    linkStore.updateStatus(B, "outbound", "active");
    const p1 = planner.planUnlink(B);
    const p2 = planner.planFullDetach();
    await expect(executor.execute(p2, p1.confirmationToken)).rejects.toThrow(
      InvalidConfirmationError,
    );
  });
});
