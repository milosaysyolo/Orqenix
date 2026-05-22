import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config/loader.js";

/**
 * Explicit verification that precedence matches v5.0 Chapter 4.1:
 *   Defaults < Global < Custom dir < Project < Inline env
 *
 * One test per layer to prove each level actually overrides the one below.
 */
describe("config loader · explicit precedence ladder", () => {
  let workDir: string;
  let configHome: string;
  let customDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "orq-prec-work-"));
    configHome = mkdtempSync(join(tmpdir(), "orq-prec-home-"));
    customDir = mkdtempSync(join(tmpdir(), "orq-prec-custom-"));
    mkdirSync(join(workDir, ".orqenix"), { recursive: true });
    mkdirSync(join(configHome, "orqenix"), { recursive: true });

    vi.stubEnv("XDG_CONFIG_HOME", configHome);
    vi.stubEnv("ORQENIX_CONFIG_DIR", "");
    vi.stubEnv("ORQENIX_CONFIG_PATH", "");
    vi.stubEnv("ORQENIX_CONFIG_CONTENT", "");
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
    rmSync(configHome, { recursive: true, force: true });
    rmSync(customDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("LEVEL 1 — defaults apply when no config file exists", async () => {
    const cfg = await loadConfig(workDir);
    expect(cfg.context.picker.topN).toBe(5);
    expect(cfg.webui.port).toBe(39397);
  });

  it("LEVEL 2 — global config overrides defaults", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 1001 } }),
    );
    const cfg = await loadConfig(workDir);
    expect(cfg.webui.port).toBe(1001);
  });

  it("LEVEL 3 — custom-dir config overrides global", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 1001 } }),
    );
    const customPath = join(customDir, "config.jsonc");
    writeFileSync(customPath, JSON.stringify({ webui: { port: 1002 } }));
    vi.stubEnv("ORQENIX_CONFIG_PATH", customPath);
    const cfg = await loadConfig(workDir);
    expect(cfg.webui.port).toBe(1002);
  });

  it("LEVEL 4 — project config overrides custom-dir", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 1001 } }),
    );
    const customPath = join(customDir, "config.jsonc");
    writeFileSync(customPath, JSON.stringify({ webui: { port: 1002 } }));
    vi.stubEnv("ORQENIX_CONFIG_PATH", customPath);
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 1003 } }),
    );
    const cfg = await loadConfig(workDir);
    expect(cfg.webui.port).toBe(1003);
  });

  it("LEVEL 5 — inline env content overrides project (highest precedence)", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 1001 } }),
    );
    const customPath = join(customDir, "config.jsonc");
    writeFileSync(customPath, JSON.stringify({ webui: { port: 1002 } }));
    vi.stubEnv("ORQENIX_CONFIG_PATH", customPath);
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 1003 } }),
    );
    vi.stubEnv("ORQENIX_CONFIG_CONTENT", JSON.stringify({ webui: { port: 1004 } }));
    const cfg = await loadConfig(workDir);
    expect(cfg.webui.port).toBe(1004);
  });

  it("non-conflicting keys merge across all layers", async () => {
    writeFileSync(
      join(configHome, "orqenix", "config.jsonc"),
      JSON.stringify({ routing: { default: "global/model" } }),
    );
    const customPath = join(customDir, "config.jsonc");
    writeFileSync(customPath, JSON.stringify({ embedding: { primary: "custom/emb" } }));
    vi.stubEnv("ORQENIX_CONFIG_PATH", customPath);
    writeFileSync(
      join(workDir, ".orqenix", "config.jsonc"),
      JSON.stringify({ webui: { port: 9999 } }),
    );
    vi.stubEnv("ORQENIX_CONFIG_CONTENT", JSON.stringify({ telemetry: { enabled: true } }));

    const cfg = await loadConfig(workDir);
    expect(cfg.routing.default).toBe("global/model");
    expect(cfg.embedding.primary).toBe("custom/emb");
    expect(cfg.webui.port).toBe(9999);
    expect(cfg.telemetry.enabled).toBe(true);
  });
});
