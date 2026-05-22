import { describe, it, expect } from "vitest";
import { PluginHost } from "../src/index.js";
import type { OrqenixPlugin } from "@orqenix/core/plugin";

describe("PluginHost", () => {
  it("loads built-in plugins", async () => {
    const builtIn: OrqenixPlugin = {
      name: "test",
      version: "1.0.0",
      hooks: {},
    };
    const host = new PluginHost({ builtIns: [builtIn] });
    await host.start();
    expect(host.registry.has("test")).toBe(true);
    await host.stop();
    expect(host.registry.has("test")).toBe(false);
  });
});
