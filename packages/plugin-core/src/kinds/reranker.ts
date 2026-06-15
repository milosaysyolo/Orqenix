// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 3: reranker
//
// Rerank search result candidates by relevance (Cohere, Voyage, local BGE-reranker).

import type { CanonicalSkillFormat } from '../csf-schema';
import type { PluginKindHandler, ValidationResult } from '../types';

export const rerankerHandler: PluginKindHandler<'reranker'> = {
  kind: 'reranker',
  description:
    'Reranks search result candidates by relevance (Cohere, Voyage, local BGE-reranker).',

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!csf.manifest.tool) {
      errors.push(
        'reranker plugins MUST declare manifest.tool with rerank(query, candidates) input schema'
      );
    } else {
      const inputSchema = csf.manifest.tool.inputSchema as {
        properties?: Record<string, unknown>;
      };
      const props = inputSchema.properties ?? {};
      if (!('query' in props) || !('candidates' in props)) {
        warnings.push(
          "reranker inputSchema should include 'query' and 'candidates' properties"
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
