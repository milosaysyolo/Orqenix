import { defineCommand } from "citty";
import consola from "consola";

export const detach = defineCommand({
  meta: { name: "detach", description: "Detach an agent session" },
  args: {
    id: { type: "string", description: "Session ID to detach" },
    force: { type: "boolean", default: false, alias: "f" },
  },
  async run({ args }) {
    if (!args.id) {
      consola.error("Missing required argument: id");
      process.exit(1);
    }
    consola.info(`Detaching session ${args.id}${args.force ? " (forced)" : ""}`);
    consola.success(`Session ${args.id} detached`);
  },
});
