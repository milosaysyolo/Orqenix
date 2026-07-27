// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 12: subagent
//
// Specialized helper agent invoked by parent. NO matrix, NO persistence
// per ADR-E-002. Single-level depth per Anti-pattern 36.

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const subagentHandler: PluginKindHandler<"subagent"> = {
  kind: "subagent",
  description:
    "Specialized helper agent invoked by parent. No matrix, ephemeral context window, terminates on return.",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!csf.manifest.tool) {
      errors.push(
        "subagent plugins MUST declare manifest.tool with invoke(harness) signature + returnSchema",
      );
    } else {
      // Subagents must declare an outputSchema (the parent absorbs the return)
      if (!csf.manifest.tool.outputSchema) {
        errors.push(
          "subagent plugins MUST declare manifest.tool.outputSchema (parent absorbs the return per CR v8.0 Section 5.1)",
        );
      }
    }

    // Subagents must NOT request memory.write (they have no persistence per ADR-E-002)
    const writePerms = csf.manifest.permissions.filter((p) => p.startsWith("memory.write"));
    if (writePerms.length > 0) {
      errors.push(
        `subagent plugins MUST NOT request memory.write permissions (no persistence per ADR-E-002): [${writePerms.join(", ")}]`,
      );
    }

    // Subagents cannot spawn sub-subagents (Anti-pattern 36, single-level depth)
    if (csf.manifest.keywords.includes("subagent-orchestrator")) {
      errors.push(
        "subagent plugins cannot orchestrate sub-subagents (single-level depth per Anti-pattern 36)",
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
