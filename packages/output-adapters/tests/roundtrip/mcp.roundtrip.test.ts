// SPDX-License-Identifier: Apache-2.0
import { describe, it } from "vitest";
import { assertRoundTrip } from "@orqenix/normalization-engine";
import { mcpInputAdapter } from "@orqenix/input-adapters";
import { mcpOutputAdapter } from "../../src/mcp";

const FIXTURES = [
  JSON.stringify(
    {
      name: "@example/mcp-server",
      version: "1.0.0",
      description: "Example MCP server",
      license: "Apache-2.0",
      main: "./dist/server.js",
      mcpServer: { name: "example", transport: "stdio", tools: ["do_thing"] },
    },
    null,
    2,
  ),
];

describe("Round-trip: mcp", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      await assertRoundTrip(FIXTURES[i] as string, mcpInputAdapter, mcpOutputAdapter);
    });
  }
});
