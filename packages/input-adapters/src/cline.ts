// SPDX-License-Identifier: Apache-2.0
// Input adapter: cline , parses .cline/tools/<name>.json

import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { ADAPTER_VERSION, readContent, sanitizeName } from './shared';

export const clineInputAdapter: InputAdapter = {
  kind: 'cline',
  version: ADAPTER_VERSION,
  name: 'Cline Tool',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.path?.includes('.cline/tools')) return { matched: true, confidence: 0.95 };
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      if (json.cline_schema_version !== undefined) return { matched: true, confidence: 0.88 };
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? '{}';
    const json = JSON.parse(content) as {
      name?: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    };
    const name = json.name ?? 'cline-tool';
    return buildCsf({
      name: `@local/${sanitizeName(name)}`,
      version: '0.1.0',
      kind: 'skill',
      tool: {
        name: sanitizeName(name).replace(/-/g, '_'),
        description: json.description ?? 'Imported Cline tool',
        inputSchema: json.inputSchema ?? { type: 'object' },
      },
      permissions: [],
      external_agent_compat: ['cline'],
      language: 'typescript',
      entry: './tool.js',
      importedFromKind: 'cline',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: json,
    });
  },
};
