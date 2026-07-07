// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , WebSocket transport
//
// For real-time agents requiring bidirectional updates. Bidirectional JSON-RPC
// over a WebSocket connection. Binds to 127.0.0.1 by default.

import type { OrqenixMcpServer } from "../server";
import type { JsonRpcRequest, JsonRpcResponse } from "./stdio";

export interface WebSocketTransportOptions {
  port?: number;
  bind?: string;
}

/**
 * WebSocket transport adapter. Each message is a JSON-RPC request; responses
 * are sent back over the same connection. Supports server-initiated
 * notifications (e.g., memory change events) for real-time agents.
 *
 * The actual ws library is dynamically imported to keep the dependency optional.
 */
export class WebSocketTransport {
  private wss: unknown = null;
  private readonly port: number;
  private readonly bind: string;

  constructor(
    private readonly mcpServer: OrqenixMcpServer,
    options: WebSocketTransportOptions = {},
  ) {
    this.port = options.port ?? 27421;
    this.bind = options.bind ?? "127.0.0.1";
  }

  async start(): Promise<void> {
    const wsModule = await import("ws").catch(() => null);
    if (!wsModule) {
      throw new Error(
        "WebSocket transport requires the 'ws' package. Install it or use stdio/http transport.",
      );
    }
    const { WebSocketServer } = wsModule as {
      WebSocketServer: new (opts: { port: number; host: string }) => {
        on(event: string, cb: (...args: unknown[]) => void): void;
        close(): void;
      };
    };

    const wss = new WebSocketServer({ port: this.port, host: this.bind });
    this.wss = wss;

    wss.on("connection", (ws: unknown) => {
      const socket = ws as {
        on(event: string, cb: (data: unknown) => void): void;
        send(data: string): void;
      };
      socket.on("message", (data: unknown) => {
        void this.handleMessage(String(data), socket);
      });
    });
  }

  async stop(): Promise<void> {
    if (this.wss) {
      (this.wss as { close(): void }).close();
      this.wss = null;
    }
  }

  private async handleMessage(raw: string, socket: { send(data: string): void }): Promise<void> {
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(raw);
    } catch {
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 0,
          error: { code: -32700, message: "Parse error" },
        } satisfies JsonRpcResponse),
      );
      return;
    }

    try {
      const result = await this.dispatch(req);
      socket.send(JSON.stringify({ jsonrpc: "2.0", id: req.id, result } satisfies JsonRpcResponse));
    } catch (err) {
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -32603, message: (err as Error).message },
        } satisfies JsonRpcResponse),
      );
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
}
