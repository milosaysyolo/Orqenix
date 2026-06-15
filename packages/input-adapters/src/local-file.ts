// SPDX-License-Identifier: Apache-2.0
// Input adapter: local-file , reads a local file + dispatches by extension

import { claudeCodeInputAdapter } from './claude-code';
import { cursorInputAdapter } from './cursor';
import { npmInputAdapter } from './npm';
import { aiderInputAdapter } from './aider';
import { opencodeInputAdapter } from './opencode';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { ADAPTER_VERSION } from './shared';

export const localFileInputAdapter: InputAdapter = {
  kind: 'local-file',
  version: ADAPTER_VERSION,
  name: 'Local File',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.path !== undefined) return { matched: true, confidence: 0.4 };
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    if (!input.path) throw new Error('local-file adapter requires a path');
    const path = input.path;
    if (path.endsWith('.cursorrules')) return cursorInputAdapter.parse(input);
    if (path.endsWith('aider_plugin.yaml')) return aiderInputAdapter.parse(input);
    if (path.includes('.opencode/agents')) return opencodeInputAdapter.parse(input);
    if (path.endsWith('.md')) return claudeCodeInputAdapter.parse(input);
    if (path.endsWith('package.json')) return npmInputAdapter.parse(input);
    const { readContent, basenameNoExt, sanitizeName } = await import('./shared');
    const content = (await readContent(input)) ?? '';
    const { buildCsf } = await import('@orqenix/normalization-engine');
    return buildCsf({
      name: `@local/${sanitizeName(basenameNoExt(path))}`,
      version: '0.1.0',
      kind: 'skill',
      tool: {
        name: sanitizeName(basenameNoExt(path)).replace(/-/g, '_'),
        description: `Imported from ${path}`,
        inputSchema: { type: 'object' },
      },
      permissions: [],
      external_agent_compat: [],
      language: 'declarative',
      entry: path,
      source: content,
      importedFromPath: path,
      importedFromKind: 'local-file',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: { content },
    });
  },
};
