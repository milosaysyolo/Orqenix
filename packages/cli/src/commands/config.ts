import { defineCommand } from "citty";
import consola from "consola";
import { loadConfig } from "@orqenix/core/config";

export const configCmd = defineCommand({
  meta: { name: "config", description: "View or edit Orqenix config" },
  subCommands: {
    show: defineCommand({
      meta: { name: "show", description: "Print merged config" },
      args: { cwd: { type: "string", default: process.cwd() } },
      async run({ args }) {
        const cfg = await loadConfig(args.cwd as string);
        consola.log(JSON.stringify(cfg, null, 2));
      },
    }),
  },
});
