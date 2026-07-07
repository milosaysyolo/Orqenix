// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 2: embedding-model
//
// Provide embedding generation for text/code (BGE, OpenAI, Voyage, jina, custom).

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const embeddingModelHandler: PluginKindHandler<"embedding-model"> = {
  kind: "embedding-model",
  description: "Provides embedding generation for text/code (BGE, OpenAI, Voyage, jina, custom).",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Must declare a tool with embed function signature
    if (!csf.manifest.tool) {
      errors.push(
        "embedding-model plugins MUST declare manifest.tool with an embed input/output schema",
      );
    } else {
      // Output schema should describe vector dimensions
      if (!csf.manifest.tool.outputSchema) {
        warnings.push(
          "embedding-model tool should declare outputSchema describing the embedding vector shape (e.g., dimension)",
        );
      }
    }

    // BYOK embedding models (OpenAI etc.) need network.fetch
    const isLocal =
      csf.implementation.language === "wasm" || csf.manifest.keywords.includes("local");
    if (!isLocal && !csf.manifest.permissions.some((p) => p.startsWith("network.fetch"))) {
      warnings.push("Remote embedding-model plugins (BYOK) require 'network.fetch' permission");
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
