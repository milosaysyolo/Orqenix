// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , HTTP transport
//
// For web-based agents (Codex web, custom dashboards). Serves JSON-RPC over
// HTTP POST. Binds to 127.0.0.1 by default (local-first).

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type { OrqenixMcpServer } from "../server";
import type { JsonRpcRequest, JsonRpcResponse } from "./stdio";

export interface HttpTransportOptions {
  port?: number;
  bind?: string;
}

/**
 * HTTP transport adapter. POST /rpc with a JSON-RPC body.
 */
export class HttpTransport {
  private server: Server | null = null;
  private readonly port: number;
  private readonly bind: string;

  constructor(
    private readonly mcpServer: OrqenixMcpServer,
    options: HttpTransportOptions = {},
  ) {
    this.port = options.port ?? 27420;
    this.bind = options.bind ?? "127.0.0.1";
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        void this.handleRequest(req, res);
      });
      this.server.listen(this.port, this.bind, () => resolve());
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Health endpoint
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "orqenix-mcp" }));
      return;
    }

    if (req.method !== "POST" || req.url !== "/rpc") {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        res.writeHead(413);
        res.end("payload too large");
        return;
      }
    }

    let rpcReq: JsonRpcRequest;
    try {
      rpcReq = JSON.parse(body);
    } catch {
      this.sendJson(res, 400, {
        jsonrpc: "2.0",
        id: 0,
        error: { code: -32700, message: "Parse error" },
      });
      return;
    }

    try {
      const result = await this.dispatch(rpcReq);
      this.sendJson(res, 200, { jsonrpc: "2.0", id: rpcReq.id, result });
    } catch (err) {
      this.sendJson(res, 200, {
        jsonrpc: "2.0",
        id: rpcReq.id,
        error: { code: -32603, message: (err as Error).message },
      });
    }
  }

  private async dispatch(req: JsonRpcRequest): Promise<unknown> {
    const params = (req.params ?? {}) as Record<string, unknown>;
    switch (req.method) {
      case "initialize":
        return this.mcpServer.handshake();
      case "tools/list":
        return { tools: this.mcpServer.listTools() };
      case "tools/call":
        return this.mcpServer.callTool(params.name as string, params.arguments);
      case "resources/list":
        return { resources: this.mcpServer.listResources() };
      case "resources/read":
        return this.mcpServer.readResource(params.uri as string);
      case "prompts/list":
        return { prompts: this.mcpServer.listPrompts() };
      case "prompts/get":
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: this.mcpServer.getPromptText(
                  params.name as string,
                  params.arguments as Record<string, unknown>,
                ),
              },
            },
          ],
        };
      default:
        throw new Error(`Method not found: ${req.method}`);
    }
  }

  private sendJson(res: ServerResponse, status: number, body: JsonRpcResponse): void {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(body));
  }
}
