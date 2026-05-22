import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  detectGitInfo,
  detectSession,
  generateScopeId,
  log,
} from "@orqenix/core";

export interface OrqenixMcpServerOptions {
  cwd?: string;
}

const ORQENIX_TOOLS = [
  {
    name: "orqenix_scope_current",
    description: "Return the current Orqenix scope (project/branch/worktree/session).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orqenix_session_id",
    description: "Return the detected session ID, or generate one if none found.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orqenix_team_list",
    description: "List installed Orqenix teams in the current project.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

export class OrqenixMcpServer {
  private server: Server;
  private cwd: string;

  constructor(opts: OrqenixMcpServerOptions = {}) {
    this.cwd = opts.cwd ?? process.cwd();
    this.server = new Server(
      { name: "orqenix", version: "0.2.0" },
      { capabilities: { tools: {} } },
    );
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ORQENIX_TOOLS as unknown as typeof ORQENIX_TOOLS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args = {} } = req.params;
      try {
        const result = await this.dispatch(name, args as Record<string, unknown>);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${String(err)}` }],
          isError: true,
        };
      }
    });
  }

  private async dispatch(name: string, _args: Record<string, unknown>): Promise<unknown> {
    if (name === "orqenix_scope_current") {
      const git = await detectGitInfo(this.cwd);
      if (!git) return { error: "not inside a git repo" };
      const session = await detectSession();
      return generateScopeId({
        project: git.repoRoot,
        branch: git.branch,
        worktree: git.worktreePath,
        session,
      });
    }
    if (name === "orqenix_session_id") {
      return { session: await detectSession() };
    }
    if (name === "orqenix_team_list") {
      const { join } = await import("node:path");
      const { readdir, readFile } = await import("node:fs/promises");
      const { existsSync } = await import("node:fs");
      const { parse } = await import("jsonc-parser");
      const teamsDir = join(this.cwd, ".orqenix", "teams");
      if (!existsSync(teamsDir)) return { teams: [] };
      const entries = await readdir(teamsDir, { withFileTypes: true });
      const teams: unknown[] = [];
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const manifestPath = join(teamsDir, e.name, "team.json");
        if (!existsSync(manifestPath)) continue;
        try {
          teams.push(parse(await readFile(manifestPath, "utf-8")));
        } catch {
          /* skip */
        }
      }
      return { teams };
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  async serveStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    log.info("mcp-server: serving over stdio");
  }
}
