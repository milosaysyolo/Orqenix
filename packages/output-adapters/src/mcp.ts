// SPDX-License-Identifier: Apache-2.0
// Output adapter: mcp , CSF → MCP server package.json with mcpServer field

import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";
import { ADAPTER_VERSION, getPreservedForKind } from "./shared";

export const mcpOutputAdapter: OutputAdapter = {
  kind: "mcp",
  version: ADAPTER_VERSION,
  name: "MCP Server Manifest",

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    const preserved = getPreservedForKind<Record<string, unknown>>(csf, "mcp");
    if (preserved) {
      return {
        content: JSON.stringify(preserved, null, 2),
        suggestedPath: "package.json",
        format: "json",
      };
    }

    const pkg = {
      name: csf.name,
      version: csf.version,
      description: csf.manifest.tool?.description ?? "",
      license: csf.manifest.license,
      main: csf.implementation.entry,
      mcpServer: {
        name: csf.name.split("/").pop(),
        transport: "stdio",
        tools: csf.manifest.tool ? [csf.manifest.tool.name] : [],
      },
    };
    return { content: JSON.stringify(pkg, null, 2), suggestedPath: "package.json", format: "json" };
  },

  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport {
    if (getPreservedForKind(csf, "mcp")) {
      return { lossyFields: [], warnings: [] };
    }
    return { lossyFields: [], warnings: [] };
  },
};
