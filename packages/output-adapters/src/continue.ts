// SPDX-License-Identifier: Apache-2.0
// Output adapter: continue , CSF → .continue config entry

import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION, getPreservedForKind, detectGenericLossy } from './shared';

export const continueOutputAdapter: OutputAdapter = {
  kind: 'continue',
  version: ADAPTER_VERSION,
  name: 'Continue.dev Provider',

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    const preserved = getPreservedForKind<Record<string, unknown>>(csf, 'continue');
    if (preserved) {
      return { content: JSON.stringify(preserved, null, 2), suggestedPath: '.continue/config.json', format: 'json' };
    }
    const entry = {
      name: csf.name.split('/').pop(),
      description: csf.manifest.tool?.description ?? '',
    };
    return { content: JSON.stringify(entry, null, 2), suggestedPath: '.continue/config.json', format: 'json' };
  },

  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport {
    if (getPreservedForKind(csf, 'continue')) {
      return { lossyFields: [], warnings: [] };
    }
    const lossy = detectGenericLossy(csf, { permissions: false, outputSchema: false });
    return { lossyFields: lossy, warnings: [] };
  },
};
