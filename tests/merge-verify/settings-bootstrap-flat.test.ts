import { describe, it, expect } from "vitest";
import { SettingsRegistry, InMemorySettingsPersistence } from "@orqenix/settings-registry";

it("FLAT dotted-key defaults (production settings-bootstrap convention) resolve correctly", async () => {
  const registry = new SettingsRegistry({ persistence: new InMemorySettingsPersistence() });
  await registry.register({
    moduleId: "@orqenix/memory-engine",
    version: "0.8.0",
    settingsSchema: {},
    defaults: { "hierarchy.level_boost.session": 1.5 },
    provenance: { phase: 8, crVersion: "v8.0", rationale: "test" },
    hotReloadable: true,
    hierarchyOverride: "all",
  });
  const resolved = await registry.resolve(
    "@orqenix/memory-engine",
    "hierarchy.level_boost.session",
    {},
  );
  expect(resolved.value).toBe(1.5);
});
