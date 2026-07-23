import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config/loader.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

describe("prototype pollution guard", () => {
  let workDir: string;
  let configHome: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "orqenix-proto-"));
    configHome = mkdtempSync(join(tmpdir(), "orqenix-cfg-"));
    mkdirSync(join(workDir, ".orqenix"), { recursive: true });
    mkdirSync(join(configHome, "orqenix"), { recursive: true });
    process.env.XDG_CONFIG_HOME = configHome;
    process.env.ORQENIX_CONFIG_DIR = "";
    process.env.ORQENIX_CONFIG_PATH = "";
    process.env.ORQENIX_CONFIG_CONTENT = "";
  });

  it("strips __proto__ from env config", async () => {
    process.env.ORQENIX_CONFIG_CONTENT = JSON.stringify({
      __proto__: { polluted: true },
      context: { picker: { topN: 7 } },
    });
    const cfg = await loadConfig(workDir);
    expect(cfg.context.picker.topN).toBe(7);
    // __proto__ key should not be present on the merged result
    expect(Object.keys(cfg)).not.toContain("__proto__");
  });

  it("strips constructor from env config", async () => {
    process.env.ORQENIX_CONFIG_CONTENT = JSON.stringify({
      constructor: { prototype: { polluted: true } },
      webui: { port: 9999 },
    });
    const cfg = await loadConfig(workDir);
    expect(cfg.webui.port).toBe(9999);
    // constructor key should not be present
    expect(Object.keys(cfg)).not.toContain("constructor");
  });

  it("nested __proto__ is stripped from file config", async () => {
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ nested: { __proto__: { polluted: true } }, webui: { port: 42 } }),
    );
    const cfg = await loadConfig(workDir);
    expect(cfg.webui.port).toBe(42);
    const nested = (cfg as any).nested;
    expect(nested).toBeDefined();
    expect(Object.keys(nested)).not.toContain("__proto__");
  });

  it("non-object input is returned as-is", async () => {
    process.env.ORQENIX_CONFIG_CONTENT = JSON.stringify({ value: "hello" });
    const cfg = await loadConfig(workDir);
    expect(cfg.context.picker.topN).toBe(DEFAULT_CONFIG.context.picker.topN);
  });
});
