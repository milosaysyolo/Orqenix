// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 11: agent
//
// Autonomous orchestrator that coordinates skills + subagents.

import type { CanonicalSkillFormat } from '../csf-schema';
import type { PluginKindHandler, ValidationResult } from '../types';

export const agentHandler: PluginKindHandler<'agent'> = {
  kind: 'agent',
  description:
    'Autonomous orchestrator that coordinates skills + subagents with full memory access.',

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!csf.manifest.tool) {
      errors.push(
        'agent plugins MUST declare manifest.tool with run(task) signature'
      );
    }

    // Agents have broad capability; should declare memory.read at minimum
    if (!csf.manifest.permissions.some((p) => p.startsWith('memory.read'))) {
      warnings.push(
        "agent plugins typically need 'memory.read:<kb>' for context access"
      );
    }

    // Agents that spawn subagents should declare command.execute
    if (csf.manifest.keywords.includes('subagent-orchestrator')) {
      if (!csf.manifest.permissions.some((p) => p.startsWith('command.execute'))) {
        warnings.push(
          "agent plugins that orchestrate subagents may need 'command.execute' permission"
        );
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
