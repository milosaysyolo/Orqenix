// SPDX-License-Identifier: Apache-2.0
// Input adapter: mcp , parses an MCP server manifest (package.json + mcpServer)

import { buildCsf } from "@orqenix/normalization-engine";
import type { InputAdapter, ImportInput, DetectionResult } from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";
import { ADAPTER_VERSION, readContent, sanitizeName } from "./shared";

export const mcpInputAdapter: InputAdapter = {
  kind: "mcp",
  version: ADAPTER_VERSION,
  name: "MCP Server Manifest",

  async detect(input: ImportInput): Promise<DetectionResult> {
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const pkg = JSON.parse(content) as Record<string, unknown>;
      if (pkg.mcpServer !== undefined) return { matched: true, confidence: 0.92 };
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? "{}";
    const pkg = JSON.parse(content) as {
      name?: string;
      version?: string;
      description?: string;
      mcpServer?: { name?: string; transport?: string; tools?: string[] };
    };
    const name = pkg.name ?? pkg.mcpServer?.name ?? "mcp-server";
    return buildCsf({
      name: name.startsWith("@") ? name : `@local/${sanitizeName(name)}`,
      version: pkg.version ?? "0.1.0",
      kind: "mcp-server",
      tool: {
        name: sanitizeName(name).replace(/-/g, "_"),
        description: pkg.description ?? "Imported MCP server",
        inputSchema: { type: "object" },
      },
      permissions: [],
      external_agent_compat: ["claude-code", "cursor", "opencode"],
      language: "typescript",
      entry: "./dist/server.js",
      importedFromKind: "mcp",
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: pkg,
    });
  },
};
