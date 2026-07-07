// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 4: compression-strategy
//
// Alternative memory compression strategies (extends Phase 2's 4 built-in strategies).

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const compressionStrategyHandler: PluginKindHandler<"compression-strategy"> = {
  kind: "compression-strategy",
  description: "Alternative memory compression strategy (extends Phase 2 4 built-in strategies).",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!csf.manifest.tool) {
      errors.push(
        "compression-strategy plugins MUST declare manifest.tool with compress(entries) signature",
      );
    }

    // Compression operates on memory entries; should declare memory.read at minimum
    if (!csf.manifest.permissions.some((p) => p.startsWith("memory.read"))) {
      warnings.push(
        "compression-strategy plugins typically need 'memory.read:<kb>' to read entries for compression",
      );
    }

    // Compression must NOT compress protected entries (per CR v8.0 INV-13)
    warnings.push(
      "REMINDER: compression-strategy MUST honor protection_flags.never_compress per INV-13 (subagent returns, pinned entries)",
    );

    return { valid: errors.length === 0, errors, warnings };
  },
};
