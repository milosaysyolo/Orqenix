import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { log } from "@orqenix/core";

export type McpTransportConfig =
  | { type: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> }
  | { type: "ws"; url: string; headers?: Record<string, string> };

export interface McpServerConfig {
  name: string;
  transport: McpTransportConfig;
  enabled?: boolean;
}

export interface McpTool {
  serverName: string;
  toolName: string;
  description?: string;
  inputSchema?: unknown;
}

export class McpClientManager {
  private clients = new Map<string, Client>();
  private tools = new Map<string, McpTool>();

  async connect(server: McpServerConfig): Promise<void> {
    if (server.enabled === false) return;
    if (this.clients.has(server.name)) {
      log.warn("mcp-client: already connected", { server: server.name });
      return;
    }

    const transport = this.makeTransport(server.transport);
    const client = new Client(
      { name: "orqenix", version: "0.2.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    this.clients.set(server.name, client);
    log.info("mcp-client: connected", { server: server.name });

    await this.refreshTools(server.name);
  }

  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) return;
    await client.close();
    this.clients.delete(serverName);
    for (const key of [...this.tools.keys()]) {
      if (key.startsWith(`${serverName}/`)) this.tools.delete(key);
    }
    log.info("mcp-client: disconnected", { server: serverName });
  }

  async disconnectAll(): Promise<void> {
    for (const name of [...this.clients.keys()]) {
      await this.disconnect(name);
    }
  }

  listTools(): McpTool[] {
    return Array.from(this.tools.values());
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`MCP server not connected: ${serverName}`);
    const response = await client.callTool({ name: toolName, arguments: args });
    return response;
  }

  private async refreshTools(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) return;
    try {
      const list = await client.listTools();
      for (const t of list.tools) {
        this.tools.set(`${serverName}/${t.name}`, {
          serverName,
          toolName: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        });
      }
    } catch (err) {
      log.warn("mcp-client: listTools failed", { server: serverName, err: String(err) });
    }
  }

  private makeTransport(cfg: McpTransportConfig) {
    if (cfg.type === "stdio") {
      return new StdioClientTransport({
        command: cfg.command,
        args: cfg.args ?? [],
        env: cfg.env,
      });
    }
    if (cfg.type === "sse") {
      return new SSEClientTransport(new URL(cfg.url), { headers: cfg.headers });
    }
    throw new Error(`Unsupported MCP transport: ${(cfg as { type: string }).type}`);
  }
}
