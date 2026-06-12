// SPDX-License-Identifier: Apache-2.0
// @orqenix/mcp-server , stdio transport
//
// Default transport for Claude Code + most CLI agents. Reads JSON-RPC messages
// from stdin, writes responses to stdout (newline-delimited).

import type { OrqenixMcpServer } from '../server';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * stdio transport adapter. Bridges newline-delimited JSON-RPC over stdin/stdout
 * to the OrqenixMcpServer protocol handlers.
 */
export class StdioTransport {
  private buffer = '';

  constructor(private readonly server: OrqenixMcpServer) {}

  /** Starts reading from stdin */
  start(): void {
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.processLines();
    });
    process.stdin.on('end', () => {
      process.exit(0);
    });
  }

  private processLines(): void {
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length > 0) {
        void this.handleLine(line);
      }
    }
  }

  private async handleLine(line: string): Promise<void> {
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line);
    } catch {
      this.send({
        jsonrpc: '2.0',
        id: 0,
        error: { code: -32700, message: 'Parse error' },
      });
      return;
    }

    try {
      const result = await this.dispatch(req);
      this.send({ jsonrpc: '2.0', id: req.id, result });
    } catch (err) {
      this.send({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32603, message: (err as Error).message },
      });
    }
  }

  /** Dispatches a JSON-RPC method to the server */
  private async dispatch(req: JsonRpcRequest): Promise<unknown> {
    const params = (req.params ?? {}) as Record<string, unknown>;
    switch (req.method) {
      case 'initialize':
        return this.server.handshake();
      case 'tools/list':
        return { tools: this.server.listTools() };
      case 'tools/call':
        return this.server.callTool(
          params.name as string,
          params.arguments
        );
      case 'resources/list':
        return { resources: this.server.listResources() };
      case 'resources/read':
        return this.server.readResource(params.uri as string);
      case 'prompts/list':
        return { prompts: this.server.listPrompts() };
      case 'prompts/get':
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: this.server.getPromptText(
                  params.name as string,
                  params.arguments as Record<string, unknown>
                ),
              },
            },
          ],
        };
      default:
        throw new Error(`Method not found: ${req.method}`);
    }
  }

  private send(response: JsonRpcResponse): void {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}
