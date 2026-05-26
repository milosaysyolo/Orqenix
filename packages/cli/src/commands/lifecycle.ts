import { defineCommand } from "citty";
import consola from "consola";

export const gcCmd = defineCommand({
  meta: { name: "gc", description: "Garbage collection" },
  subCommands: {
    status: defineCommand({
      meta: { name: "status", description: "Show GC status" },
      async run() {
        consola.log("GC status: OK");
      },
    }),
    run: defineCommand({
      meta: { name: "run", description: "Run garbage collection" },
      args: { dryRun: { type: "boolean", default: false } },
      async run({ args }) {
        consola.log(args.dryRun ? "GC dry-run: OK" : "GC run: OK");
      },
    }),
  },
});

export const trashCmd = defineCommand({
  meta: { name: "trash", description: "Manage trash" },
  subCommands: {
    add: defineCommand({
      meta: { name: "add", description: "Add to trash" },
      args: { ref: { type: "positional", required: true } },
      async run({ args }) {
        consola.log(`Added to trash: ${args.ref}`);
      },
    }),
    list: defineCommand({
      meta: { name: "list", description: "List trash" },
      async run() {
        consola.log("Trash: empty");
      },
    }),
    restore: defineCommand({
      meta: { name: "restore", description: "Restore from trash" },
      args: { ref: { type: "positional", required: true } },
      async run({ args }) {
        consola.log(`Restored: ${args.ref}`);
      },
    }),
  },
});

export const historyCmd = defineCommand({
  meta: { name: "history", description: "Show generation history" },
  async run() {
    consola.log("Generations: 1");
  },
});
