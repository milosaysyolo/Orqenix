// SPDX-License-Identifier: Apache-2.0
// Output adapter: opencode , CSF → .opencode/agents/<name>.yaml

import { stringify as stringifyYaml } from 'yaml';
import type {
  OutputAdapter,
  SerializedFormat,
  ExportabilityReport,
} from '@orqenix/normalization-engine';
import type { CanonicalSkillFormat } from '@orqenix/csf';
import { ADAPTER_VERSION, getPreservedForKind } from './shared';

export const opencodeOutputAdapter: OutputAdapter = {
  kind: 'opencode',
  version: ADAPTER_VERSION,
  name: 'OpenCode Agent',

  async serialize(csf: CanonicalSkillFormat): Promise<SerializedFormat> {
    const preserved = getPreservedForKind<Record<string, unknown>>(csf, 'opencode');
    if (preserved) {
      return {
        content: stringifyYaml(preserved, { indent: 2 }),
        suggestedPath: `.opencode/agents/${csf.name.split('/').pop()}.yaml`,
        format: 'yaml',
      };
    }

    const agent = {
      name: csf.name.split('/').pop(),
      version: csf.version,
      description: csf.manifest.tool?.description ?? '',
      permissions: csf.manifest.permissions,
    };
    return {
      content: stringifyYaml(agent, { indent: 2 }),
      suggestedPath: `.opencode/agents/${csf.name.split('/').pop()}.yaml`,
      format: 'yaml',
    };
  },

  validateExportability(csf: CanonicalSkillFormat): ExportabilityReport {
    if (getPreservedForKind(csf, 'opencode')) {
      return { lossyFields: [], warnings: [] };
    }
    return { lossyFields: [], warnings: ['OpenCode agent schema differs; review after export'] };
  },
};
