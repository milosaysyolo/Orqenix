// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { MarketplaceCrud, CrudOperationError, type LocalPluginStore } from "../src/crud";
import { InMemoryPluginAuditWriter } from "@orqenix/plugin-core";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";

class InMemoryStore implements LocalPluginStore {
  private map = new Map<string, CanonicalSkillFormat>();
  async get(name: string) {
    return this.map.get(name) ?? null;
  }
  async set(csf: CanonicalSkillFormat) {
    this.map.set(csf.name, csf);
  }
  async delete(name: string) {
    this.map.delete(name);
  }
  async list() {
    return Array.from(this.map.values());
  }
}

describe("MarketplaceCrud", () => {
  let store: InMemoryStore;
  let audit: InMemoryPluginAuditWriter;
  let crud: MarketplaceCrud;

  beforeEach(() => {
    store = new InMemoryStore();
    audit = new InMemoryPluginAuditWriter();
    crud = new MarketplaceCrud(store, audit as never, "milo");
  });

  it("creates a new skill plugin", async () => {
    const result = await crud.create({
      name: "@local/git-commit",
      kind: "skill",
      description: "Git commit helper",
      permissions: ["git.write"],
      external_agent_compat: ["claude-code"],
      tool: {
        name: "git_commit",
        description: "Creates a commit",
        inputSchema: { type: "object" },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.version).toBe("0.1.0");
  });

  it("rejects creating a duplicate", async () => {
    await crud.create({
      name: "@local/dup",
      kind: "skill",
      description: "x",
      permissions: [],
      external_agent_compat: [],
      tool: { name: "dup", description: "x", inputSchema: { type: "object" } },
    });
    await expect(
      crud.create({
        name: "@local/dup",
        kind: "skill",
        description: "x",
        permissions: [],
        external_agent_compat: [],
        tool: { name: "dup", description: "x", inputSchema: { type: "object" } },
      }),
    ).rejects.toBeInstanceOf(CrudOperationError);
  });

  it("updates with version bump", async () => {
    await crud.create({
      name: "@local/upd",
      kind: "skill",
      description: "x",
      permissions: [],
      external_agent_compat: ["claude-code"],
      tool: {
        name: "upd",
        description: "x",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    });
    const result = await crud.update({
      name: "@local/upd",
      bump: "minor",
      changes: {},
      changesSummary: "add feature",
    });
    expect(result.version).toBe("0.2.0");
  });

  it("bumps major correctly", async () => {
    await crud.create({
      name: "@local/maj",
      kind: "skill",
      description: "x",
      permissions: [],
      external_agent_compat: ["claude-code"],
      tool: {
        name: "maj",
        description: "x",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
    });
    const result = await crud.update({ name: "@local/maj", bump: "major", changes: {} });
    expect(result.version).toBe("1.0.0");
  });

  it("deletes with correct confirmation", async () => {
    await crud.create({
      name: "@local/del",
      kind: "skill",
      description: "x",
      permissions: [],
      external_agent_compat: [],
      tool: { name: "del", description: "x", inputSchema: { type: "object" } },
    });
    const result = await crud.delete({
      name: "@local/del",
      confirmation: "DELETE @local/del",
    });
    expect(result.ok).toBe(true);
    expect(await store.get("@local/del")).toBeNull();
  });

  it("rejects delete with wrong confirmation", async () => {
    await crud.create({
      name: "@local/del2",
      kind: "skill",
      description: "x",
      permissions: [],
      external_agent_compat: [],
      tool: { name: "del2", description: "x", inputSchema: { type: "object" } },
    });
    await expect(crud.delete({ name: "@local/del2", confirmation: "wrong" })).rejects.toThrow(
      /Confirmation must be exactly/,
    );
  });

  it("forks a plugin into new namespace with version reset", async () => {
    await crud.create({
      name: "@orqenix/original",
      kind: "skill",
      description: "original",
      permissions: ["scope.read"],
      external_agent_compat: ["cursor"],
      tool: { name: "orig", description: "x", inputSchema: { type: "object" } },
    });
    const result = await crud.fork({
      sourceName: "@orqenix/original",
      newName: "@local/my-fork",
    });
    expect(result.ok).toBe(true);
    expect(result.version).toBe("0.1.0");

    const forked = await store.get("@local/my-fork");
    expect(forked?.name).toBe("@local/my-fork");
    expect(await store.get("@orqenix/original")).not.toBeNull();
  });

  it("audits each operation", async () => {
    await crud.create({
      name: "@local/aud",
      kind: "skill",
      description: "x",
      permissions: [],
      external_agent_compat: [],
      tool: { name: "aud", description: "x", inputSchema: { type: "object" } },
    });
    const events = (audit as never as { getEvents(): Array<{ kind: string }> }).getEvents();
    expect(events.some((e) => e.kind === "marketplace.crud_create")).toBe(true);
  });
});
