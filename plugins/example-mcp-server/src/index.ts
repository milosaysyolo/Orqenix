// SPDX-License-Identifier: Apache-2.0
// Reference mcp-server plugin: minimal MCP server.
//
// Demonstrates the mcp-server plugin kind: a long-running server exposing tools.
// Per ADR-E-005, requires compatibility.mcp; uses separate_process sandbox.

interface EchoInput {
  message: string;
}

interface EchoOutput {
  echoed: string;
}

/**
 * MCP tool handler. The mcp-server lifecycle (activate/deactivate) starts/stops
 * the server process; this exports the tool the server registers.
 */
export async function echo(input: EchoInput): Promise<EchoOutput> {
  return { echoed: `echo: ${input.message}` };
}

/** MCP server registration metadata (consumed by the activate script) */
export const mcpServer = {
  name: "example-echo-server",
  transport: "stdio" as const,
  tools: [
    {
      name: "echo",
      description: "Echoes input back",
      handler: echo,
    },
  ],
};
