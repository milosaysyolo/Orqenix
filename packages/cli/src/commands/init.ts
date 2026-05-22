import { defineCommand } from "citty";
import consola from "consola";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { projectOrqenixDir, projectOpencodeDir } from "@orqenix/core";

export const init = defineCommand({
  meta: {
    name: "init",
    description: "Initialize Orqenix in the current project",
  },
  args: {
    cwd: { type: "string", default: process.cwd() },
    force: { type: "boolean", default: false },
  },
  async run({ args }) {
    const root = args.cwd as string;
    consola.start(`Initializing Orqenix in ${root}`);

    const orqenixDir = projectOrqenixDir(root);
    const opencodeDir = projectOpencodeDir(root);

    // Create all required dirs
    for (const sub of [
      orqenixDir,
      join(orqenixDir, "teams"),
      join(orqenixDir, "scope"),
      join(orqenixDir, "knowledge"),
      join(orqenixDir, "memory"),
      join(orqenixDir, "cache"),
      join(orqenixDir, "sync"),
      join(orqenixDir, "logs"),
      opencodeDir,
      join(opencodeDir, "agents"),
      join(opencodeDir, "skills"),
      join(opencodeDir, "plugin"),
    ]) {
      await mkdir(sub, { recursive: true });
    }

    // .orqenix/config.jsonc (Phase 1: stub, Phase 2+ will add provider templates)
    const configPath = join(orqenixDir, "config.jsonc");
    if (!existsSync(configPath) || args.force) {
      await writeFile(
        configPath,
        [
          `{`,
          `  "$schema": "https://orqenix.dev/schema/config.json",`,
          `  "version": "1.0"`,
          `  // Phase 2 will add provider, routing, and plugin templates here.`,
          `  // For now, defaults apply. Edit this file to customize.`,
          `}`,
          "",
        ].join("\n"),
        "utf-8",
      );
    }

    // opencode.json (merge if exists)
    const opencodePath = join(root, "opencode.json");
    const baseOpenCode = existsSync(opencodePath)
      ? JSON.parse(await readFile(opencodePath, "utf-8"))
      : {};

    const existingPlugins: string[] = Array.isArray(baseOpenCode.plugin) ? baseOpenCode.plugin : [];

    // Phase 1: We register the plugin reference for forward compat.
    // The actual @orqenix/opencode-plugin package ships in Phase 2.
    // OpenCode will warn (not fail) if the package is missing.
    const orqenixPlugin = "@orqenix/opencode-plugin";
    const plugin = existingPlugins.includes(orqenixPlugin)
      ? existingPlugins
      : [...existingPlugins, orqenixPlugin];

    const merged = {
      $schema: "https://opencode.ai/config.json",
      ...baseOpenCode,
      plugin,
      default_agent: baseOpenCode.default_agent ?? "dev-team-lead",
    };
    await writeFile(opencodePath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

    // AGENTS.md (Phase 1: stub project conventions doc)
    const agentsPath = join(root, "AGENTS.md");
    if (!existsSync(agentsPath)) {
      await writeFile(
        agentsPath,
        [
          "# Project Conventions",
          "",
          "This file is read by Orqenix agents as ground truth for project rules.",
          "",
          "## Stack",
          "",
          "<!-- stub: describe languages, frameworks, tooling -->",
          "",
          "## Code style",
          "",
          "<!-- stub: link to .prettierrc, .eslintrc, formatter conventions -->",
          "",
          "## Testing",
          "",
          "<!-- stub: how to run tests, where to put them -->",
          "",
          "## Branch and commit conventions",
          "",
          "<!-- stub: e.g., conventional commits, PR templates -->",
          "",
        ].join("\n"),
        "utf-8",
      );
    }

    consola.success("Orqenix initialized");
    consola.info("Next steps:");
    consola.info("  orqenix doctor              # diagnose your setup");
    consola.info("  orqenix team list           # see installed teams");
    consola.info("  edit AGENTS.md              # describe project conventions");
    consola.info("");
    consola.info("Note: @orqenix/opencode-plugin will be available in Phase 2. Until then,");
    consola.info("OpenCode may warn that the plugin is missing — this is expected.");
  },
});
