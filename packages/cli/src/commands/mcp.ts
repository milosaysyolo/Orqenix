import { defineCommand } from "citty";
import consola from "consola";
import { OrqenixMcpServer } from "@orqenix/mcp-server";

export const mcpCmd = defineCommand({
  meta: { name: "mcp", description: "MCP server / client utilities" },
  subCommands: {
    serve: defineCommand({
      meta: { name: "serve", description: "Run Orqenix as an MCP server (stdio)" },
      args: {
        cwd: { type: "string", default: process.cwd() },
        transport: { type: "string", default: "stdio" },
      },
      async run({ args }) {
        const transport = args.transport as string;
        if (transport !== "stdio") {
          consola.error(`Only stdio transport is supported in Phase 2. Got: ${transport}`);
          process.exit(1);
        }
        const server = new OrqenixMcpServer({ cwd: args.cwd as string });
        consola.info("Starting Orqenix MCP server on stdio...");
        await server.serveStdio();
      },
    }),
  },
});
