// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 13: skill
//
// Atomic capability (MCP-tool-compatible). Stateless, invokable from any
// agent platform that declares external_agent_compat.

import type { CanonicalSkillFormat } from '../csf-schema';
import type { PluginKindHandler, ValidationResult } from '../types';

export const skillHandler: PluginKindHandler<'skill'> = {
  kind: 'skill',
  description:
    'Atomic capability (MCP-tool-compatible). Stateless, invokable from any agent platform.',

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Skills MUST declare a tool (the invokable function)
    if (!csf.manifest.tool) {
      errors.push(
        'skill plugins MUST declare manifest.tool with name + description + inputSchema'
      );
    } else {
      if (!csf.manifest.tool.inputSchema) {
        errors.push('skill manifest.tool MUST declare inputSchema');
      }
      // Skills should declare outputSchema for conformance testing
      if (!csf.manifest.tool.outputSchema) {
        warnings.push(
          'skill plugins should declare manifest.tool.outputSchema for conformance verification'
        );
      }
    }

    // Skills should declare external_agent_compat for cross-platform portability
    if (csf.manifest.external_agent_compat.length === 0) {
      warnings.push(
        'skill plugins should declare external_agent_compat for cross-platform portability (e.g., ["claude-code", "cursor", "codex"])'
      );
    }

    // Skills should provide examples for conformance + documentation
    if (
      !csf.implementation.examples ||
      csf.implementation.examples.length === 0
    ) {
      warnings.push(
        'skill plugins should provide implementation.examples for conformance testing + documentation'
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
