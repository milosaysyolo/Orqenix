// SPDX-License-Identifier: Apache-2.0
// Input adapter: user-custom , imports from a user-defined JSONSchema mapping

import { z } from "zod";
import { buildCsf } from "@orqenix/normalization-engine";
import type { InputAdapter, ImportInput, DetectionResult } from "@orqenix/normalization-engine";
import type { CanonicalSkillFormat, PluginKind } from "@orqenix/plugin-core";
import { ADAPTER_VERSION, readContent, sanitizeName } from "./shared";

const CustomWrapperSchema = z.object({
  __orqenix_custom: z.object({
    name: z.string(),
    kind: z.string(),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    external_agent_compat: z.array(z.string()).optional(),
    language: z.string().optional(),
    entry: z.string().optional(),
    source: z.string().optional(),
  }),
});

export const userCustomInputAdapter: InputAdapter = {
  kind: "user-custom",
  version: ADAPTER_VERSION,
  name: "User-Defined Format",

  async detect(input: ImportInput): Promise<DetectionResult> {
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      if (json.__orqenix_custom !== undefined) {
        return { matched: true, confidence: 0.95 };
      }
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? "{}";
    const parsed = CustomWrapperSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      throw new Error(
        "user-custom adapter requires a __orqenix_custom wrapper. See docs/onboarding for the schema.",
      );
    }
    const c = parsed.data.__orqenix_custom;
    return buildCsf({
      name: c.name.startsWith("@") ? c.name : `@local/${sanitizeName(c.name)}`,
      version: "0.1.0",
      kind: c.kind as PluginKind,
      tool: {
        name: sanitizeName(c.name).replace(/-/g, "_"),
        description: c.description ?? "User-defined imported plugin",
        inputSchema: { type: "object" },
      },
      permissions: c.permissions ?? [],
      external_agent_compat: c.external_agent_compat ?? [],
      language: (c.language as never) ?? "declarative",
      entry: c.entry ?? "./plugin.js",
      ...(c.source ? { source: c.source } : {}),
      importedFromKind: "user-custom",
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: parsed.data,
    });
  },
};
