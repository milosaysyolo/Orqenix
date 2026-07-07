// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from "vitest";
import { SettingsRegistry } from "../src/registry";
import { InMemorySettingsAuditWriter } from "../src/types";
import { InMemorySettingsPersistence } from "../src/persistence";
import type { ModuleSettingsContract } from "../src/types";

function memoryContract(overrides: Partial<ModuleSettingsContract> = {}): ModuleSettingsContract {
  return {
    moduleId: "@orqenix/memory-engine",
    version: "0.8.0",
    settingsSchema: {},
    defaults: { "hierarchy.level_boost.session": 1.5 },
    provenance: { phase: 8, crVersion: "v8.0", rationale: "test" },
    hotReloadable: true,
    hierarchyOverride: "all",
    ...overrides,
  };
}

describe("SettingsRegistry", () => {
  let audit: InMemorySettingsAuditWriter;
  let persistence: InMemorySettingsPersistence;
  let registry: SettingsRegistry;

  beforeEach(() => {
    audit = new InMemorySettingsAuditWriter();
    persistence = new InMemorySettingsPersistence();
    registry = new SettingsRegistry({ auditWriter: audit, persistence });
  });

  it("registers a module and audits it", async () => {
    await registry.register(memoryContract());
    expect(registry.count()).toBe(1);
    expect(audit.getEvents().some((e) => e.kind === "settings.module_registered")).toBe(true);
  });

  it("throws when accessing unregistered module (Anti-pattern 37)", async () => {
    await expect(registry.resolve("@nope/module", "foo", {})).rejects.toThrow(/not registered/);
  });

  it("resolves a registered setting", async () => {
    await registry.register(memoryContract());
    const resolved = await registry.resolve(
      "@orqenix/memory-engine",
      "hierarchy.level_boost.session",
      {},
    );
    expect(resolved.value).toBe(1.5);
  });

  it("updates a setting at project level + audits", async () => {
    await registry.register(memoryContract());
    await registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 2.5, {
      level: "project",
      hierarchyId: "blake3:proj",
      setBy: "milo",
    });

    const resolved = await registry.resolve(
      "@orqenix/memory-engine",
      "hierarchy.level_boost.session",
      { projectId: "blake3:proj" },
    );
    expect(resolved.value).toBe(2.5);

    const changeEvents = audit.getEvents().filter((e) => e.kind === "settings.changed");
    expect(changeEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("fires hot reload handler on update", async () => {
    let handlerNew: unknown = null;
    let handlerOld: unknown = null;
    await registry.register(
      memoryContract({
        hotReloadable: true,
        hotReloadHandler: (newVal, oldVal) => {
          handlerNew = newVal;
          handlerOld = oldVal;
        },
      }),
    );

    await registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 9.9, {
      level: "project",
      hierarchyId: "blake3:proj",
    });

    expect(handlerNew).toBe(9.9);
    expect(handlerOld).toBe(1.5); // old = built-in default
  });

  it("rolls back on hot reload failure", async () => {
    await registry.register(
      memoryContract({
        hotReloadable: true,
        hotReloadHandler: () => {
          throw new Error("reload boom");
        },
      }),
    );

    await expect(
      registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 9.9, {
        level: "project",
        hierarchyId: "blake3:proj",
      }),
    ).rejects.toThrow("reload boom");

    // Value rolled back to default
    const resolved = await registry.resolve(
      "@orqenix/memory-engine",
      "hierarchy.level_boost.session",
      { projectId: "blake3:proj" },
    );
    expect(resolved.value).toBe(1.5);

    // Audited the failure
    expect(audit.getEvents().some((e) => e.kind === "settings.hot_reload_failed")).toBe(true);
  });

  it("notifies watchers on change", async () => {
    await registry.register(memoryContract());
    const seen: Array<[unknown, unknown]> = [];
    const unsubscribe = registry.watch(
      "@orqenix/memory-engine",
      "hierarchy.level_boost.session",
      (n, o) => seen.push([n, o]),
    );

    await registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 4.0, {
      level: "project",
      hierarchyId: "blake3:proj",
    });

    expect(seen).toEqual([[4.0, 1.5]]);

    unsubscribe();
    await registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 5.0, {
      level: "project",
      hierarchyId: "blake3:proj",
    });
    // No new notification after unsubscribe
    expect(seen).toHaveLength(1);
  });

  it("revert removes an override", async () => {
    await registry.register(memoryContract());
    await registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 7.0, {
      level: "project",
      hierarchyId: "blake3:proj",
    });
    await registry.revert("@orqenix/memory-engine", "hierarchy.level_boost.session", {
      level: "project",
      hierarchyId: "blake3:proj",
    });

    const resolved = await registry.resolve(
      "@orqenix/memory-engine",
      "hierarchy.level_boost.session",
      { projectId: "blake3:proj" },
    );
    expect(resolved.value).toBe(1.5);
    expect(resolved.source).toBe("built-in-default");
  });

  it("throws if override level missing required hierarchyId", async () => {
    await registry.register(memoryContract());
    await expect(
      registry.update(
        "@orqenix/memory-engine",
        "hierarchy.level_boost.session",
        2.0,
        { level: "project" }, // missing hierarchyId
      ),
    ).rejects.toThrow(/requires hierarchyId/);
  });

  it("runs module validator and rejects invalid value", async () => {
    await registry.register(
      memoryContract({
        validate: (v) =>
          typeof v === "number" && v >= 0.5 && v <= 3.0
            ? { valid: true, errors: [] }
            : { valid: false, errors: ["boost must be 0.5-3.0"] },
      }),
    );

    await expect(
      registry.update("@orqenix/memory-engine", "hierarchy.level_boost.session", 99, {
        level: "project",
        hierarchyId: "blake3:proj",
      }),
    ).rejects.toThrow(/boost must be 0.5-3.0/);
  });
});
