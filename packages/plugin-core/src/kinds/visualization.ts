// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 7: visualization
//
// Render custom visualizations in Workbench (timeline, graph, charts, dashboards).

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const visualizationHandler: PluginKindHandler<"visualization"> = {
  kind: "visualization",
  description: "Renders custom Workbench visualizations (timeline, graph, charts, dashboards).",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Visualizations run in the Workbench UI context (React/Web Component)
    if (
      csf.implementation.language !== "typescript" &&
      csf.implementation.language !== "javascript" &&
      csf.implementation.language !== "wasm"
    ) {
      errors.push(
        `visualization plugins must use typescript/javascript/wasm (got '${csf.implementation.language}')`,
      );
    }

    // Visualizations are read-only views; should NOT request write permissions
    const writePerms = csf.manifest.permissions.filter((p) => p.includes(".write"));
    if (writePerms.length > 0) {
      warnings.push(
        `visualization plugins are read-only views; requesting write permissions is unusual: [${writePerms.join(", ")}]`,
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
