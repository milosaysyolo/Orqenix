import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Registry } from "../index.js";

describe("registry behavior tests", () => {
  let dbPath: string;
  let registry: Registry;

  beforeEach(async () => {
    dbPath = mkdtempSync(join(tmpdir(), "registry-test-"));
    registry = await Registry.open(join(dbPath, "registry.db"));
  });

  afterEach(async () => {
    await registry.close();
    rmSync(dbPath, { recursive: true, force: true });
  });

  it("add creates new registry entry", async () => {
    const id = randomUUID();
    const entry = {
      id,
      name: "my-skill",
      version: "1.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
    };
    await registry.add(entry);
    const retrieved = await registry.get(id);
    expect(retrieved?.name).toBe("my-skill");
  });

  it("get retrieves entry by id", async () => {
    const id = randomUUID();
    const entry = {
      id,
      name: "my-skill",
      version: "1.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
    };
    await registry.add(entry);
    const retrieved = await registry.get(id);
    expect(retrieved?.name).toBe("my-skill");
    expect(retrieved?.version).toBe("1.0.0");
  });

  it("list returns all entries", async () => {
    await registry.add({
      id: randomUUID(),
      name: "skill1",
      version: "1.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
    });
    await registry.add({
      id: randomUUID(),
      name: "skill2",
      version: "1.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
    });
    const entries = await registry.list();
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it("update changes entry state", async () => {
    const id = randomUUID();
    await registry.add({
      id,
      name: "my-skill",
      version: "1.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
    });
    await registry.update(id, { state: "STALE" });
    const updated = await registry.get(id);
    expect(updated?.state).toBe("STALE");
  });

  it("remove soft-deletes entry to TRASH", async () => {
    const id = randomUUID();
    await registry.add({
      id,
      name: "my-skill",
      version: "1.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
    });
    await registry.remove(id);
    const removed = await registry.get(id);
    expect(removed?.state).toBe("TRASH");
  });

  it("checkConflicts detects duplicate active entries", async () => {
    const id1 = randomUUID();
    await registry.add({
      id: id1,
      name: "my-skill",
      version: "1.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
    });
    const conflicts = await registry.checkConflicts({
      id: randomUUID(),
      name: "my-skill",
      version: "2.0.0",
      type: "skill" as const,
      state: "ACTIVE" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(conflicts.length).toBeGreaterThan(0);
  });
});
