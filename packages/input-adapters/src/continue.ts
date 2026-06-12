// SPDX-License-Identifier: Apache-2.0
// Input adapter: continue , parses ~/.continue config plugin entry

import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION, readContent, sanitizeName } from './shared';

export const continueInputAdapter: InputAdapter = {
  kind: 'continue',
  version: ADAPTER_VERSION,
  name: 'Continue.dev Provider',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.path?.includes('.continue')) return { matched: true, confidence: 0.9 };
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      if (Array.isArray(json.models) || json.continueVersion !== undefined) {
        return { matched: true, confidence: 0.8 };
      }
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? '{}';
    const json = JSON.parse(content) as { name?: string };
    const name = json.name ?? 'continue-provider';
    return buildCsf({
      name: `@local/${sanitizeName(name)}`,
      version: '0.1.0',
      kind: 'prompt-rewriter',
      permissions: [],
      external_agent_compat: ['continue'],
      language: 'declarative',
      entry: './provider.json',
      source: content,
      ...(input.path ? { importedFromPath: input.path } : {}),
      importedFromKind: 'continue',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: json,
    });
  },
};
