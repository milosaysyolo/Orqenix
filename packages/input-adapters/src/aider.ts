// SPDX-License-Identifier: Apache-2.0
// Input adapter: aider , parses a Python package with aider_plugin.yaml

import { parse as parseYaml } from 'yaml';
import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION, readContent, sanitizeName } from './shared';

export const aiderInputAdapter: InputAdapter = {
  kind: 'aider',
  version: ADAPTER_VERSION,
  name: 'Aider Plugin',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.path?.endsWith('aider_plugin.yaml')) return { matched: true, confidence: 0.95 };
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const y = parseYaml(content) as Record<string, unknown>;
      if (y.aider_version !== undefined) return { matched: true, confidence: 0.85 };
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? '';
    const y = (parseYaml(content) ?? {}) as Record<string, unknown>;
    const name = (y.name as string) ?? 'aider-plugin';
    return buildCsf({
      name: `@local/${sanitizeName(name)}`,
      version: (y.version as string) ?? '0.1.0',
      kind: 'skill',
      tool: {
        name: sanitizeName(name).replace(/-/g, '_'),
        description: (y.description as string) ?? 'Imported Aider plugin',
        inputSchema: { type: 'object' },
      },
      permissions: (y.permissions as string[]) ?? [],
      external_agent_compat: ['aider'],
      language: 'python',
      entry: (y.entry as string) ?? './plugin.py',
      source: content,
      ...(input.path ? { importedFromPath: input.path } : {}),
      importedFromKind: 'aider',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: y,
    });
  },
};
