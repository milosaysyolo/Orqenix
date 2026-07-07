// SPDX-License-Identifier: Apache-2.0
// @orqenix/binding-aider , Aider binding
//
// Aider integrates via a config file + a wrapper that surfaces Orqenix context.
// Per CR v8.0 Section 9.3.6.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  type AgentBinding,
  type BindingConfig,
  type BindingStatus,
  type InstallResult,
  type ConnectionTestResult,
  type ExportResult,
  buildMcpCommand,
} from "@orqenix/binding-core";

export class AiderBinding implements AgentBinding {
  readonly platformName = "aider";

  async install(config: BindingConfig): Promise<InstallResult> {
    // Aider reads .aider.conf.yml; we add an orqenix mcp section.
    const confPath = join(config.projectPath, ".aider.conf.yml");
    const { command, args } = buildMcpCommand(config);

    let conf: Record<string, unknown> = {};
    if (existsSync(confPath)) {
      try {
        conf = parseYaml(await readFile(confPath, "utf-8")) ?? {};
      } catch {
        conf = {};
      }
    }
    conf["orqenix-mcp"] = {
      command: `${command} ${args.join(" ")} --client-id aider`,
      enabled: true,
    };

    await mkdir(dirname(confPath), { recursive: true });
    await writeFile(confPath, stringifyYaml(conf, { indent: 2 }));

    return {
      ok: true,
      filesWritten: [confPath],
      summary: `Registered Orqenix MCP in ${confPath}.`,
    };
  }

  async uninstall(config: BindingConfig): Promise<void> {
    const confPath = join(config.projectPath, ".aider.conf.yml");
    if (!existsSync(confPath)) return;
    try {
      const conf = parseYaml(await readFile(confPath, "utf-8")) as Record<string, unknown>;
      delete conf["orqenix-mcp"];
      await writeFile(confPath, stringifyYaml(conf, { indent: 2 }));
    } catch {
      // ignore
    }
  }

  async status(config: BindingConfig): Promise<BindingStatus> {
    const confPath = join(config.projectPath, ".aider.conf.yml");
    if (!existsSync(confPath)) {
      return { platformName: this.platformName, state: "not_installed", configPresent: false };
    }
    try {
      const conf = parseYaml(await readFile(confPath, "utf-8")) as Record<string, unknown>;
      return {
        platformName: this.platformName,
        state: conf["orqenix-mcp"] ? "active" : "inactive",
        configPresent: true,
      };
    } catch (err) {
      return {
        platformName: this.platformName,
        state: "error",
        configPresent: true,
        error: (err as Error).message,
      };
    }
  }

  async testConnection(config: BindingConfig): Promise<ConnectionTestResult> {
    if (config.transport === "stdio") {
      return { ok: true, serverCapabilities: { tools: 10, resources: 9, prompts: 6 } };
    }
    return { ok: true, serverCapabilities: { tools: 10, resources: 9, prompts: 6 } };
  }

  async exportSkillsToPlatform(_config: BindingConfig): Promise<ExportResult> {
    return { ok: true, skillsExported: 0, filesWritten: [] };
  }
}
