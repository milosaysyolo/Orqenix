import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config/loader.js";
import { DEFAULT_CONFIG } from "../src/config/defaults.js";

describe("config loader", () => {
  let workDir: string;
  let configHome: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "orqenix-cfg-work-"));
    configHome = mkdtempSync(join(tmpdir(), "orqenix-cfg-home-"));
    mkdirSync(join(workDir, ".orqenix"), { recursive: true });
    mkdirSync(join(configHome, "orqenix"), { recursive: true });
    vi.stubEnv("XDG_CONFIG_HOME", configHome);
    vi.stubEnv("ORQENIX_CONFIG_DIR", "");
    vi.stubEnv("ORQENIX_CONFIG_PATH", "");
    vi.stubEnv("ORQENIX_CONFIG_CONTENT", "");
  });

  it("returns DEFAULT_CONFIG when no files exist", async () => {
    const cfg = await loadConfig(workDir);
    expect(cfg.version).toBe(DEFAULT_CONFIG.version);
    expect(cfg.context.picker.topN).toBe(5);
  });

  it("project config overrides global on conflicts", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ context: { picker: { topN: 3 } } }),
    );
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ context: { picker: { topN: 9 } } }),
    );
    const cfg = await loadConfig(workDir);
    expect(cfg.context.picker.topN).toBe(9);
  });

  it("non-conflicting settings are merged", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ routing: { default: "x/y" } }),
    );
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 12345 } }),
    );
    const cfg = await loadConfig(workDir);
    expect(cfg.routing.default).toBe("x/y");
    expect(cfg.webui.port).toBe(12345);
  });

  it("arrays are replaced not concatenated", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ context: { compressContext: { protectPatterns: ["A"] } } }),
    );
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ context: { compressContext: { protectPatterns: ["B"] } } }),
    );
    const cfg = await loadConfig(workDir);
    expect(cfg.context.compressContext.protectPatterns).toEqual(["B"]);
  });

  it("invalid JSONC logs but does not throw", async () => {
    writeFileSync(join(configHome, "orqenix", "config.jsonc"), "{ this is not json");
    await expect(loadConfig(workDir)).resolves.toBeDefined();
  });

  it("inline env content takes highest precedence", async () => {
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 1 } }),
    );
    vi.stubEnv("ORQENIX_CONFIG_CONTENT", JSON.stringify({ webui: { port: 2 } }));
    const cfg = await loadConfig(workDir);
    expect(cfg.webui.port).toBe(2);
  });

  it("unknown top-level keys are preserved", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ customExperiment: { enabled: true, threshold: 0.5 } }),
    );
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ futureFeature: "beta" }),
    );
    const cfg = await loadConfig(workDir);
    expect((cfg as any).customExperiment).toEqual({ enabled: true, threshold: 0.5 });
    expect((cfg as any).futureFeature).toBe("beta");
  });
});
