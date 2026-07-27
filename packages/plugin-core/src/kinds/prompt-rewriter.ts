// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 6: prompt-rewriter
//
// Rewrite user prompts for better retrieval/execution (extends Phase 4 Qwen default).

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const promptRewriterHandler: PluginKindHandler<"prompt-rewriter"> = {
  kind: "prompt-rewriter",
  description:
    "Rewrites user prompts for better retrieval/execution (extends Phase 4 Qwen 2.5 7B default).",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!csf.manifest.tool) {
      errors.push(
        "prompt-rewriter plugins MUST declare manifest.tool with rewrite(prompt, context) signature",
      );
    }

    // BYOK rewriters (GPT-4o-mini etc.) need network.fetch
    const isLocal =
      csf.implementation.language === "wasm" || csf.manifest.keywords.includes("local");
    if (!isLocal && !csf.manifest.permissions.some((p) => p.startsWith("network.fetch"))) {
      warnings.push(
        "Remote prompt-rewriter plugins (BYOK GPT/Claude/Gemini) require 'network.fetch' permission",
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
