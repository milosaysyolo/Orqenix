// SPDX-License-Identifier: Apache-2.0
// Output adapter: claude-code , CSF → .claude/skills/<name>.md with frontmatter

import { stringify as stringifyYaml } from "yaml";
import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";
import { ADAPTER_VERSION, getPreservedForKind } from "./shared";

interface ClaudeCodePreserved {
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
}

export const claudeCodeOutputAdapter: OutputAdapter = {
  kind: "claude-code",
  version: ADAPTER_VERSION,
  name: "Claude Code Skill",

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    // Round-trip: if imported FROM claude-code, reconstruct verbatim (INV-15)
    const preserved = getPreservedForKind<ClaudeCodePreserved>(csf, "claude-code");
    if (preserved?.raw) {
      return {
        content: preserved.raw,
        suggestedPath: `.claude/skills/${csf.name.split("/").pop()}.md`,
        format: "markdown",
      };
    }

    // Cross-format export: synthesize from CSF
    const skillName = csf.name.split("/").pop() ?? "skill";
    const frontmatter: Record<string, unknown> = {
      skill: skillName,
      description: csf.manifest.tool?.description ?? "",
    };
    if (csf.manifest.permissions.length > 0) {
      frontmatter.permissions = csf.manifest.permissions;
    }
    if (csf.manifest.tool?.inputSchema) {
      frontmatter.inputSchema = csf.manifest.tool.inputSchema;
    }

    const body =
      typeof csf.implementation.source === "string"
        ? csf.implementation.source
        : `# ${skillName}\n\n${csf.manifest.tool?.description ?? ""}`;

    const content = `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n${body}`;
    return {
      content,
      suggestedPath: `.claude/skills/${skillName}.md`,
      format: "markdown",
    };
  },

  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport {
    // If round-trip from claude-code, nothing is lost
    if (getPreservedForKind(csf, "claude-code")) {
      return { lossyFields: [], warnings: [] };
    }
    // Claude Code supports most fields via frontmatter; outputSchema is informal
    const warnings: string[] = [];
    if (csf.manifest.external_agent_compat.length > 1) {
      warnings.push("external_agent_compat is informational in Claude Code skills");
    }
    return { lossyFields: [], warnings };
  },
};
