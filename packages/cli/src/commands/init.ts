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
    const root = args.cwd;
    consola.start(`Initializing Orqenix in ${root}`);

    const orqenixDir = projectOrqenixDir(root);
    const opencodeDir = projectOpencodeDir(root);

    await mkdir(orqenixDir, { recursive: true });
    await mkdir(join(orqenixDir, "teams"), { recursive: true });
    await mkdir(join(orqenixDir, "scope"), { recursive: true });
    await mkdir(join(orqenixDir, "knowledge"), { recursive: true });
    await mkdir(join(orqenixDir, "memory"), { recursive: true });
    await mkdir(join(orqenixDir, "cache"), { recursive: true });
    await mkdir(join(orqenixDir, "sync"), { recursive: true });
    await mkdir(join(orqenixDir, "logs"), { recursive: true });
    await mkdir(join(opencodeDir, "agents"), { recursive: true });
    await mkdir(join(opencodeDir, "skills"), { recursive: true });
    await mkdir(join(opencodeDir, "plugin"), { recursive: true });

    // .orqenix/config.jsonc
    const configPath = join(orqenixDir, "config.jsonc");
    if (!existsSync(configPath) || args.force) {
      await writeFile(
        configPath,
        `{
  "$schema": "https://orqenix.dev/schema/config.json",
  "version": "1.0"
}
`,
        "utf-8",
      );
    }

    // opencode.json (merge if exists)
    const opencodePath = join(root, "opencode.json");
    const baseOpenCode = existsSync(opencodePath)
      ? JSON.parse(await readFile(opencodePath, "utf-8"))
      : {};
    const merged = {
      $schema: "https://opencode.ai/config.json",
      ...baseOpenCode,
      plugin: Array.from(
        new Set([...(baseOpenCode.plugin ?? []), "@orqenix/opencode-plugin"]),
      ),
      default_agent: baseOpenCode.default_agent ?? "dev-team-lead",
    };
    await writeFile(opencodePath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

    consola.success("Orqenix initialized");
    consola.info("Next: orqenix doctor");
  },
});
