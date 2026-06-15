// SPDX-License-Identifier: Apache-2.0
// Input adapter: claude-code , parses .claude/skills/<name>.md with frontmatter

import { parse as parseYaml } from 'yaml';
import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { ADAPTER_VERSION, readContent, sanitizeName } from './shared';

export const claudeCodeInputAdapter: InputAdapter = {
  kind: 'claude-code',
  version: ADAPTER_VERSION,
  name: 'Claude Code Skill',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.path?.includes('.claude/skills')) return { matched: true, confidence: 0.95 };
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    const hasFrontmatter = /^---\n[\s\S]*?\bskill\b[\s\S]*?\n---/.test(content);
    return { matched: hasFrontmatter, confidence: hasFrontmatter ? 0.85 : 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? '';
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(content);
    const fm = m ? (parseYaml(m[1] as string) as Record<string, unknown>) : {};
    const body = m ? (m[2] ?? '') : content;

    const skillName = (fm.skill as string) ?? (fm.name as string) ?? 'imported-skill';
    return buildCsf({
      name: `@local/${sanitizeName(skillName)}`,
      version: (fm.version as string) ?? '0.1.0',
      kind: 'skill',
      tool: {
        name: sanitizeName(skillName).replace(/-/g, '_'),
        description: (fm.description as string) ?? body.slice(0, 200),
        inputSchema: (fm.inputSchema as Record<string, unknown>) ?? { type: 'object' },
        ...(fm.outputSchema ? { outputSchema: fm.outputSchema as Record<string, unknown> } : {}),
      },
      permissions: (fm.permissions as string[]) ?? [],
      external_agent_compat: ['claude-code'],
      language: 'declarative',
      entry: './skill.md',
      source: body,
      ...(input.path ? { importedFromPath: input.path } : {}),
      importedFromKind: 'claude-code',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: { frontmatter: fm, body, raw: content },
    });
  },
};
