// SPDX-License-Identifier: Apache-2.0
// Output adapter: cursor , CSF → .cursorrules

import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION, getPreservedForKind, detectGenericLossy } from './shared';

interface CursorPreserved {
  rules: string;
}

export const cursorOutputAdapter: OutputAdapter = {
  kind: 'cursor',
  version: ADAPTER_VERSION,
  name: 'Cursor Rules',

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    // Round-trip: reconstruct verbatim rules
    const preserved = getPreservedForKind<CursorPreserved>(csf, 'cursor');
    if (preserved?.rules !== undefined) {
      return { content: preserved.rules, suggestedPath: '.cursorrules', format: 'text' };
    }

    // Cross-format: emit the source as plain rules
    const rules =
      typeof csf.implementation.source === 'string'
        ? csf.implementation.source
        : (csf.manifest.tool?.description ?? '');
    return { content: rules, suggestedPath: '.cursorrules', format: 'text' };
  },

  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport {
    if (getPreservedForKind(csf, 'cursor')) {
      return { lossyFields: [], warnings: [] };
    }
    // .cursorrules is plain text; structured fields are lost
    const lossy = detectGenericLossy(csf, {
      outputSchema: false,
      permissions: false,
      externalAgentCompat: false,
      license: false,
    });
    return {
      lossyFields: lossy,
      warnings: ['.cursorrules is plain text; structured metadata is dropped'],
    };
  },
};
