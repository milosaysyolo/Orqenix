// SPDX-License-Identifier: Apache-2.0
// Input adapter: url , downloads a tarball/zip and reads its package.json

import { npmInputAdapter } from './npm';
import type { InputAdapter, ImportInput, DetectionResult } from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION } from './shared';

export const urlInputAdapter: InputAdapter = {
  kind: 'url',
  version: ADAPTER_VERSION,
  name: 'Direct URL',

  async detect(input: ImportInput): Promise<DetectionResult> {
    if (input.url && /\.(tar\.gz|tgz|zip)(\?.*)?$/.test(input.url)) {
      return { matched: true, confidence: 0.85 };
    }
    return { matched: false, confidence: 0 };
  },

  async parse(input: ImportInput): Promise<CanonicalSkillFormat> {
    if (!input.url) throw new Error('url adapter requires a url');
    const pkgUrl = input.url.replace(/\.(tar\.gz|tgz|zip)(\?.*)?$/, '/package.json');
    try {
      const resp = await fetch(pkgUrl, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const content = await resp.text();
        const csf = await npmInputAdapter.parse({ content });
        if (csf.provenance.imported_from) {
          csf.provenance.imported_from.kind = 'url';
          csf.provenance.imported_from.original_url = input.url;
        }
        return csf;
      }
    } catch {
      // fall through to error below
    }
    throw new Error(
      `url adapter could not resolve package.json for ${input.url}. Extraction is handled by the install flow.`
    );
  },
};
