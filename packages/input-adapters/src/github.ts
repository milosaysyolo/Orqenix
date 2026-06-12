// SPDX-License-Identifier: Apache-2.0
// Input adapter: github , clones/fetches a GitHub repo's package.json

import { npmInputAdapter } from './npm';
import { buildCsf } from '@orqenix/normalization-engine';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION } from './shared';

export const githubInputAdapter: InputAdapter = {
  kind: 'github',
  version: ADAPTER_VERSION,
  name: 'GitHub Repository',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.url && /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(input.url)) {
      return { matched: true, confidence: 0.9 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    if (!input.url) {
      throw new Error('github adapter requires a url');
    }
    const m = /github\.com\/([^/]+)\/([^/]+)/.exec(input.url);
    if (!m) throw new Error('Invalid GitHub URL');
    const [, owner, repo] = m;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`;

    const resp = await fetch(rawUrl, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      throw new Error(`Could not fetch package.json from ${input.url}: HTTP ${resp.status}`);
    }
    const pkgContent = await resp.text();

    const csf = await npmInputAdapter.parse({ content: pkgContent });
    return buildCsf({
      name: csf.name,
      version: csf.version,
      kind: csf.kind,
      ...(csf.manifest.tool ? { tool: csf.manifest.tool as Record<string, unknown> } : {}),
      permissions: csf.manifest.permissions,
      external_agent_compat: csf.manifest.external_agent_compat,
      license: csf.manifest.license,
      keywords: csf.manifest.keywords,
      repository: input.url,
      language: csf.implementation.language as never,
      entry: csf.implementation.entry,
      importedFromUrl: input.url,
      importedFromKind: 'github',
      normalizerVersion: ADAPTER_VERSION,
      originalFormatPreserved: csf.provenance.original_format_preserved,
    });
  },
};
