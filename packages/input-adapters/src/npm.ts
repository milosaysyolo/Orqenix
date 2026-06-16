// SPDX-License-Identifier: Apache-2.0
// Input adapter: npm , parses a package.json with orqenixPlugin field

import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat, PluginKind } from '@orqenix/plugin-core';
import { ADAPTER_VERSION, readContent } from './shared';

export const npmInputAdapter: InputAdapter = {
  kind: 'npm',
  version: ADAPTER_VERSION,
  name: 'npm Package',

  async detect(input: ImportInput): Promise<DetectionResult> {
    const content = await readContent(input);
    if (!content) return { matched: false, confidence: 0 };
    try {
      const pkg = JSON.parse(content) as Record<string, unknown>;
      if (pkg.orqenixPlugin !== undefined) return { matched: true, confidence: 0.99 };
    } catch {
      return { matched: false, confidence: 0 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    const content = (await readContent(input)) ?? '{}';
    const pkg = JSON.parse(content) as {
      name: string;
      version: string;
      description?: string;
      license?: string;
      main?: string;
      keywords?: string[];
      homepage?: string;
      orqenixPlugin: {
        kind: string;
        tool?: Record<string, unknown>;
        permissions?: string[];
        external_agent_compat?: string[];
      };
    };
    const op = pkg.orqenixPlugin;
    return buildCsf({
      name: pkg.name,
      version: pkg.version,
      kind: op.kind as PluginKind,
      ...(op.tool ? { tool: op.tool } : {}),
      permissions: op.permissions ?? [],
      external_agent_compat: op.external_agent_compat ?? [],
      license: pkg.license ?? 'Apache-2.0',
      keywords: pkg.keywords ?? [],
      ...(pkg.homepage ? { homepage: pkg.homepage } : {}),
      language: 'typescript',
      entry: pkg.main ?? './dist/plugin.js',
      importedFromKind: 'npm',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: pkg,
    });
  },
};
