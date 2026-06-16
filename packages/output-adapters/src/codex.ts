// SPDX-License-Identifier: Apache-2.0
// Output adapter: codex , CSF → ChatGPT GPT JSON export

import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { ADAPTER_VERSION, getPreservedForKind, detectGenericLossy } from './shared';

export const codexOutputAdapter: OutputAdapter = {
  kind: 'codex',
  version: ADAPTER_VERSION,
  name: 'ChatGPT Codex GPT Export',

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    const preserved = getPreservedForKind<Record<string, unknown>>(csf, 'codex');
    if (preserved) {
      return {
        content: JSON.stringify(preserved, null, 2),
        suggestedPath: `${csf.name.split('/').pop()}.gpt.json`,
        format: 'json',
      };
    }

    const gptExport = {
      schema_version: 'gpt-export-v1',
      name: csf.name.split('/').pop(),
      description: csf.manifest.tool?.description ?? '',
      instructions:
        typeof csf.implementation.source === 'string' ? csf.implementation.source : '',
    };
    return {
      content: JSON.stringify(gptExport, null, 2),
      suggestedPath: `${csf.name.split('/').pop()}.gpt.json`,
      format: 'json',
    };
  },

  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport {
    if (getPreservedForKind(csf, 'codex')) {
      return { lossyFields: [], warnings: [] };
    }
    const lossy = detectGenericLossy(csf, {
      outputSchema: false,
      permissions: false,
      externalAgentCompat: false,
      license: false,
    });
    return { lossyFields: lossy, warnings: ['GPT export does not carry Orqenix permissions/schema'] };
  },
};
