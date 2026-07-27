// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 5: memory-injection-strategy
//
// Alternative context injection strategy (extends Phase 2 strategies A-E, default B).

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const memoryInjectionStrategyHandler: PluginKindHandler<"memory-injection-strategy"> = {
  kind: "memory-injection-strategy",
  description:
    "Alternative context injection strategy (extends Phase 2 strategies A-E, default B).",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!csf.manifest.tool) {
      errors.push(
        "memory-injection-strategy plugins MUST declare manifest.tool with inject(query, memory) signature",
      );
    }

    if (!csf.manifest.permissions.some((p) => p.startsWith("memory.read"))) {
      warnings.push(
        "memory-injection-strategy plugins need 'memory.read:<kb>' to select context for injection",
      );
    }

    warnings.push(
      "REMINDER: injection-strategy MUST respect hierarchy fan-out (session→branch→project) and token budget per CR v8.0 Section 4.4",
    );

    return { valid: errors.length === 0, errors, warnings };
  },
};
