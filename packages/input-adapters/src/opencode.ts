// SPDX-License-Identifier: Apache-2.0
// Input adapter: opencode , parses .opencode/agents/<name>.yaml

import { parse as parseYaml } from 'yaml';
import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION, readContent, sanitizeName } from './shared';

export const opencodeInputAdapter: InputAdapter = {
  kind: 'opencode',
  version: ADAPTER_VERSION,
  name: 'OpenCode Agent',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.path?.includes('.opencode/agents')) return { matched: true, confidence: 0.95 };
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const y = parseYaml(content) as Record<string, unknown>;
      if (y.agentcli !== undefined || y.opencode_version !== undefined) {
        return { matched: true, confidence: 0.85 };
      }
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? '';
    const y = (parseYaml(content) ?? {}) as Record<string, unknown>;
    const name = (y.name as string) ?? 'opencode-agent';
    return buildCsf({
      name: `@local/${sanitizeName(name)}`,
      version: (y.version as string) ?? '0.1.0',
      kind: 'agent',
      tool: {
        name: sanitizeName(name).replace(/-/g, '_'),
        description: (y.description as string) ?? 'Imported OpenCode agent',
        inputSchema: { type: 'object' },
      },
      permissions: (y.permissions as string[]) ?? [],
      external_agent_compat: ['opencode'],
      language: 'declarative',
      entry: './agent.yaml',
      source: content,
      ...(input.path ? { importedFromPath: input.path } : {}),
      importedFromKind: 'opencode',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: y,
    });
  },
};
