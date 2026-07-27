// SPDX-License-Identifier: Apache-2.0
// Input adapter: private-git , parses a plugin from a private Git SSH URL

import type { InputAdapter, ImportInput, DetectionResult } from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";
import { buildCsf } from "@orqenix/normalization-engine";
import { ADAPTER_VERSION, sanitizeName } from "./shared";

export const privateGitInputAdapter: InputAdapter = {
  kind: "private-git",
  version: ADAPTER_VERSION,
  name: "Private Git",

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.url && /^git@[^:]+:.+\.git$/.test(input.url)) {
      return { matched: true, confidence: 0.9 };
    }
    if (input.url && /^ssh:\/\//.test(input.url)) {
      return { matched: true, confidence: 0.85 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    if (!input.url) throw new Error("private-git adapter requires an SSH url");
    const repoName =
      input.url
        .replace(/\.git$/, "")
        .split(/[:/]/)
        .pop() ?? "private-plugin";
    return buildCsf({
      name: `@private/${sanitizeName(repoName)}`,
      version: "0.1.0",
      kind: "skill",
      tool: {
        name: sanitizeName(repoName).replace(/-/g, "_"),
        description: `Plugin from private Git: ${input.url}`,
        inputSchema: { type: "object" },
      },
      permissions: [],
      external_agent_compat: [],
      language: "typescript",
      entry: "./dist/plugin.js",
      importedFromUrl: input.url,
      importedFromKind: "private-git",
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: { gitUrl: input.url, refinedAfterClone: false },
    });
  },
};
