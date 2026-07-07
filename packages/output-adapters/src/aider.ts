// SPDX-License-Identifier: Apache-2.0
// Output adapter: aider , CSF → aider_plugin.yaml

import { stringify as stringifyYaml } from "yaml";
import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";
import { ADAPTER_VERSION, getPreservedForKind } from "./shared";

export const aiderOutputAdapter: OutputAdapter = {
  kind: "aider",
  version: ADAPTER_VERSION,
  name: "Aider Plugin",

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    const preserved = getPreservedForKind<Record<string, unknown>>(csf, "aider");
    if (preserved) {
      return {
        content: stringifyYaml(preserved, { indent: 2 }),
        suggestedPath: "aider_plugin.yaml",
        format: "yaml",
      };
    }
    const plugin = {
      name: csf.name.split("/").pop(),
      version: csf.version,
      description: csf.manifest.tool?.description ?? "",
      aider_version: ">=0.40.0",
      entry: csf.implementation.entry,
    };
    return {
      content: stringifyYaml(plugin, { indent: 2 }),
      suggestedPath: "aider_plugin.yaml",
      format: "yaml",
    };
  },

  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport {
    if (getPreservedForKind(csf, "aider")) {
      return { lossyFields: [], warnings: [] };
    }
    return { lossyFields: [], warnings: ["Aider plugin requires Python entry; review entry path"] };
  },
};
