// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 9: kb-schema
//
// Extend default 4 KBs (Chat/Code/Decision/Lesson) with custom knowledge schemas.

import type { CanonicalSkillFormat } from "../csf-schema";
import type { PluginKindHandler, ValidationResult } from "../types";

export const kbSchemaHandler: PluginKindHandler<"kb-schema"> = {
  kind: "kb-schema",
  description:
    "Extends default 4 KBs (Chat/Code/Decision/Lesson) with a custom knowledge base schema.",

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // kb-schema must declare a settingsSchema describing the new KB structure
    if (!csf.manifest.settingsSchema) {
      errors.push(
        "kb-schema plugins MUST declare settingsSchema describing the custom KB structure + columns",
      );
    }

    // Custom KB names must not collide with built-in 4 KBs
    const reservedNames = ["chat", "code", "decision", "lesson"];
    const declaredName = csf.name.split("/").pop()?.toLowerCase() ?? "";
    if (reservedNames.includes(declaredName)) {
      errors.push(
        `kb-schema plugin name collides with built-in KB '${declaredName}'. Choose a different name.`,
      );
    }

    // kb-schema activate runs a schema migration; warn about migration ID range
    warnings.push(
      "REMINDER: kb-schema plugins must use migration IDs >= 1000 to avoid collision with core (Phase 8 reserves 500-599)",
    );

    return { valid: errors.length === 0, errors, warnings };
  },

  async onInstall(csf: CanonicalSkillFormat): Promise<void> {
    // kb-schema install would run the schema migration to create new KB tables.
    // D8.α.6 (Memory Engine) wires the actual migration runner.
    // For D8.α.4 this is a no-op placeholder.
    void csf;
  },
};
