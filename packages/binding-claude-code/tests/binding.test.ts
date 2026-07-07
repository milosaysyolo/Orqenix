// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { ClaudeCodeBinding } from "../src/binding";
import type { BindingConfig } from "@orqenix/binding-core";

describe("ClaudeCodeBinding", () => {
  let tmpDir: string;
  let binding: ClaudeCodeBinding;
  let config: BindingConfig;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "orqenix-claude-binding-"));
    binding = new ClaudeCodeBinding();
    config = {
      projectPath: tmpDir,
      transport: "stdio",
      autoRegisterSkills: true,
    };
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("platformName is claude-code", () => {
    expect(binding.platformName).toBe("claude-code");
  });

  it("install writes .mcp.json with orqenix server", async () => {
    const result = await binding.install(config);
    expect(result.ok).toBe(true);
    const mcpJsonPath = join(tmpDir, ".mcp.json");
    expect(existsSync(mcpJsonPath)).toBe(true);

    const content = JSON.parse(await readFile(mcpJsonPath, "utf-8")) as {
      mcpServers: { orqenix: { command: string; args: string[] } };
    };
    expect(content.mcpServers.orqenix).toBeDefined();
    expect(content.mcpServers.orqenix.command).toBe("orqenix-mcp");
    expect(content.mcpServers.orqenix.args).toContain("--client-id");
    expect(content.mcpServers.orqenix.args).toContain("claude-code");
  });

  it("status reports active after install", async () => {
    await binding.install(config);
    const status = await binding.status(config);
    expect(status.state).toBe("active");
    expect(status.configPresent).toBe(true);
  });

  it("status reports not_installed before install", async () => {
    const status = await binding.status(config);
    expect(status.state).toBe("not_installed");
    expect(status.configPresent).toBe(false);
  });

  it("uninstall removes orqenix from .mcp.json", async () => {
    await binding.install(config);
    await binding.uninstall(config);
    const status = await binding.status(config);
    // config still present but orqenix removed → inactive
    expect(status.state).toBe("inactive");
  });

  it("install preserves other mcp servers", async () => {
    // Pre-write an existing .mcp.json with another server
    const { writeFile } = await import("node:fs/promises");
    const mcpJsonPath = join(tmpDir, ".mcp.json");
    await writeFile(
      mcpJsonPath,
      JSON.stringify({ mcpServers: { other: { command: "other-server" } } }),
    );

    await binding.install(config);

    const content = JSON.parse(await readFile(mcpJsonPath, "utf-8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(content.mcpServers.other).toBeDefined();
    expect(content.mcpServers.orqenix).toBeDefined();
  });

  it("testConnection ok for stdio transport", async () => {
    const result = await binding.testConnection(config);
    expect(result.ok).toBe(true);
    expect(result.serverCapabilities?.tools).toBe(10);
  });
});
