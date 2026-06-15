// SPDX-License-Identifier: Apache-2.0
// Input adapter: cursor , parses .cursorrules text files

import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { ADAPTER_VERSION, readContent } from './shared';

export const cursorInputAdapter: InputAdapter = {
  kind: 'cursor',
  version: ADAPTER_VERSION,
  name: 'Cursor Rules',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.path?.endsWith('.cursorrules')) return { matched: true, confidence: 0.98 };
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? '';
    return buildCsf({
      name: '@local/cursor-rules',
      version: '0.1.0',
      kind: 'prompt-rewriter',
      permissions: [],
      external_agent_compat: ['cursor'],
      language: 'declarative',
      entry: './.cursorrules',
      source: content,
      ...(input.path ? { importedFromPath: input.path } : {}),
      importedFromKind: 'cursor',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: { rules: content },
    });
  },
};
