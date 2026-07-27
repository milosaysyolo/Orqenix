// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 1: knowledge-source
//
// Connect external knowledge bases (Notion, Linear, Jira, Confluence, custom REST).

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const knowledgeSourceHandler: PluginKindHandler<"knowledge-source"> = {
  kind: "knowledge-source",
  description:
    "Connects external knowledge bases (Notion, Linear, Jira, Confluence, custom REST APIs).",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // knowledge-source typically needs network.fetch permission
    if (!csf.manifest.permissions.some((p) => p.startsWith("network.fetch"))) {
      warnings.push(
        "knowledge-source plugins usually require 'network.fetch' permission to connect to external APIs",
      );
    }

    // Should declare memory.write for at least one KB to ingest knowledge
    const hasMemoryWrite = csf.manifest.permissions.some((p) => p.startsWith("memory.write"));
    if (!hasMemoryWrite) {
      warnings.push(
        "knowledge-source plugins typically need 'memory.write:<kb>' to ingest fetched knowledge",
      );
    }

    // Must declare a settings schema (connection config like API keys, endpoints)
    if (!csf.manifest.settingsSchema) {
      warnings.push(
        "knowledge-source plugins should declare settingsSchema for connection configuration",
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
