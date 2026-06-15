// SPDX-License-Identifier: Apache-2.0
// Output adapter: npm , CSF → package.json with orqenixPlugin field
//
// This is the canonical lossless export: CSF maps directly to an Orqenix npm
// package. Always byte-identical round-trip from npm import.

import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/plugin-core';
import { ADAPTER_VERSION, getPreservedForKind } from './shared';

export const npmOutputAdapter: OutputAdapter = {
  kind: 'npm',
  version: ADAPTER_VERSION,
  name: 'npm Package',

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    // Round-trip from npm: reconstruct the exact package.json
    const preserved = getPreservedForKind<Record<string, unknown>>(csf, 'npm');
    if (preserved) {
      return { content: JSON.stringify(preserved, null, 2), suggestedPath: 'package.json', format: 'json' };
    }

    // Build a fresh package.json from CSF (canonical, lossless mapping)
    const pkg: Record<string, unknown> = {
      name: csf.name,
      version: csf.version,
      description: csf.manifest.tool?.description ?? '',
      license: csf.manifest.license,
      main: csf.implementation.entry,
      keywords: [...csf.manifest.keywords, 'orqenix-plugin'],
      orqenixPlugin: {
        manifestVersion: csf.manifestVersion,
        kind: csf.kind,
        compatibility: csf.manifest.compatibility,
        permissions: csf.manifest.permissions,
        external_agent_compat: csf.manifest.external_agent_compat,
        ...(csf.manifest.tool ? { tool: csf.manifest.tool } : {}),
        sandboxMode: csf.manifest.sandboxMode,
      },
    };
    if (csf.manifest.homepage) pkg.homepage = csf.manifest.homepage;
    return { content: JSON.stringify(pkg, null, 2), suggestedPath: 'package.json', format: 'json' };
  },

  validateExportability(_csf: CanonicalSkillFormat): ExportabilityReport {
    // npm package.json + orqenixPlugin is the canonical CSF mapping , never lossy
    return { lossyFields: [], warnings: [] };
  },
};
