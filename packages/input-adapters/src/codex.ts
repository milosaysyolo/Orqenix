// SPDX-License-Identifier: Apache-2.0
// Input adapter: codex , parses ChatGPT GPT JSON export

import { buildCsf } from "@orqenix/normalization-engine";
import type { InputAdapter, ImportInput, DetectionResult } from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat } from "@orqenix/plugin-core";
import { ADAPTER_VERSION, readContent, sanitizeName } from "./shared";

export const codexInputAdapter: InputAdapter = {
  kind: "codex",
  version: ADAPTER_VERSION,
  name: "ChatGPT Codex GPT Export",

  async detect(input: ImportInput): Promise<DetectionResult> {
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      if (json.schema_version === "gpt-export-v1" || (json.gpt && json.instructions)) {
        return { matched: true, confidence: 0.9 };
      }
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? "{}";
    const json = JSON.parse(content) as {
      name?: string;
      gpt?: { name?: string };
      instructions?: string;
      description?: string;
    };
    const name = json.name ?? json.gpt?.name ?? "codex-gpt";
    return buildCsf({
      name: `@local/${sanitizeName(name)}`,
      version: "0.1.0",
      kind: "agent",
      tool: {
        name: sanitizeName(name).replace(/-/g, "_"),
        description: json.description ?? "Imported ChatGPT Codex GPT",
        inputSchema: { type: "object" },
      },
      permissions: [],
      external_agent_compat: ["codex"],
      language: "declarative",
      entry: "./gpt.json",
      source: json.instructions ?? "",
      importedFromKind: "codex",
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: json,
    });
  },
};
