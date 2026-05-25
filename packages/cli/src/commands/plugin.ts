import { defineCommand } from "citty";
import consola from "consola";
import kleur from "kleur";
import Table from "cli-table3";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseJsonc } from "jsonc-parser";
import { PluginHost } from "@orqenix/plugin-host";

export const pluginCmd = defineCommand({
  meta: { name: "plugin", description: "Manage Orqenix plugins" },
  subCommands: {
    list: defineCommand({
      meta: { name: "list", description: "List loaded plugins" },
      args: { cwd: { type: "string", default: process.cwd() } },
      async run({ args }) {
        const cwd = args.cwd as string;
        const opencodePath = join(cwd, "opencode.json");
        let npmPlugins: string[] = [];
        if (existsSync(opencodePath)) {
          const oc = parseJsonc(await readFile(opencodePath, "utf-8"));
          if (Array.isArray(oc?.plugin)) npmPlugins = oc.plugin;
        }
        const host = new PluginHost({ projectRoot: cwd, npmPlugins });
        await host.start();
        const plugins = host.registry.list();
        if (plugins.length === 0) {
          consola.warn("No plugins loaded.");
          consola.info("Add npm plugins to opencode.json or drop .ts files in .opencode/plugin/");
          await host.stop();
          return;
        }
        const table = new Table({
          head: [
            kleur.bold("Plugin"),
            kleur.bold("Version"),
            kleur.bold("Priority"),
            kleur.bold("Hooks"),
            kleur.bold("Capabilities"),
          ],
          style: { head: [], border: ["gray"] },
        });
        for (const p of plugins) {
          const hookCount = Object.keys(p.hooks).length;
          table.push([
            p.name,
            p.version,
            String(p.priority ?? 0),
            String(hookCount),
            (p.capabilities ?? []).join(", ") || kleur.gray("—"),
          ]);
        }
        consola.log(table.toString());
        await host.stop();
      },
    }),

    info: defineCommand({
      meta: { name: "info", description: "Show detailed info about a plugin" },
      args: {
        name: { type: "positional", required: true },
        cwd: { type: "string", default: process.cwd() },
      },
      async run({ args }) {
        const cwd = args.cwd as string;
        const opencodePath = join(cwd, "opencode.json");
        let npmPlugins: string[] = [];
        if (existsSync(opencodePath)) {
          const oc = parseJsonc(await readFile(opencodePath, "utf-8"));
          if (Array.isArray(oc?.plugin)) npmPlugins = oc.plugin;
        }
        const host = new PluginHost({ projectRoot: cwd, npmPlugins });
        await host.start();
        const plugin = host.registry.get(args.name as string);
        if (!plugin) {
          consola.error(`Plugin not found: ${args.name}`);
          await host.stop();
          process.exit(1);
        }
        consola.log(kleur.bold(plugin.name));
        consola.log(`  version:      ${plugin.version}`);
        consola.log(`  description:  ${plugin.description ?? "(none)"}`);
        consola.log(`  priority:     ${plugin.priority ?? 0}`);
        consola.log(`  capabilities: ${(plugin.capabilities ?? []).join(", ") || "—"}`);
        consola.log(`  hooks:`);
        for (const k of Object.keys(plugin.hooks)) {
          consola.log(`    - ${k}`);
        }
        await host.stop();
      },
    }),

    check: defineCommand({
      meta: { name: "check", description: "Validate plugin configuration in opencode.json" },
      args: { cwd: { type: "string", default: process.cwd() } },
      async run({ args }) {
        const cwd = args.cwd as string;
        const opencodePath = join(cwd, "opencode.json");
        if (!existsSync(opencodePath)) {
          consola.error("opencode.json not found");
          process.exit(1);
        }
        const oc = parseJsonc(await readFile(opencodePath, "utf-8"));
        if (!Array.isArray(oc?.plugin)) {
          consola.warn("opencode.json has no plugin array");
          return;
        }
        const host = new PluginHost({ projectRoot: cwd, npmPlugins: oc.plugin });
        await host.start();
        const loaded = host.registry.list().map((p) => p.name);
        const expected = (oc.plugin as string[]).map((s) =>
          s.replace(/@[^@/]+$/, "").replace(/^@latest$/, ""),
        );
        consola.log(kleur.bold(`Configured plugins (${expected.length}):`));
        for (const e of expected) {
          const found = loaded.some(
            (l) => e.includes(l) || l.includes(e.replace(/^@orqenix\//, "")),
          );
          consola.log(`  ${found ? kleur.green("✓") : kleur.red("✗")} ${e}`);
        }
        await host.stop();
      },
    }),
  },
});
