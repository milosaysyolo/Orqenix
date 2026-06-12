// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 14: agent-binding
//
// Bridge Orqenix with external agent platforms (Claude Code, Cursor, Codex,
// OpenCode, Cline, Aider, Continue, future platforms).

import type { CanonicalSkillFormat } from '../csf-schema';
import type { PluginKindHandler, ValidationResult } from '../types';

/** Known agent platforms (extensible) */
const KNOWN_PLATFORMS = [
  'claude-code',
  'cursor',
  'codex',
  'opencode',
  'cline',
  'aider',
  'continue',
];

export const agentBindingHandler: PluginKindHandler<'agent-binding'> = {
  kind: 'agent-binding',
  description:
    'Bridges Orqenix with external agent platforms (Claude Code, Cursor, Codex, OpenCode, Cline, Aider, Continue).',

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // agent-binding must target a platform via keywords or settings
    const targetPlatform = csf.manifest.keywords.find((k) =>
      KNOWN_PLATFORMS.includes(k)
    );
    if (!targetPlatform) {
      warnings.push(
        `agent-binding should declare its target platform via keywords. Known: [${KNOWN_PLATFORMS.join(', ')}]`
      );
    }

    // Per Anti-pattern 41: bindings must be Apache-2.0 (no vendor lock-in)
    if (csf.manifest.license !== 'Apache-2.0') {
      errors.push(
        `agent-binding plugins MUST be Apache-2.0 (got '${csf.manifest.license}'). No vendor lock-in per Anti-pattern 41.`
      );
    }

    // Bindings register Orqenix skills with the target platform; need scope.read
    if (!csf.manifest.permissions.some((p) => p === 'scope.read')) {
      warnings.push(
        "agent-binding plugins typically need 'scope.read' to register Orqenix capabilities with the platform"
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  async onActivate(csf: CanonicalSkillFormat): Promise<void> {
    // agent-binding activate registers Orqenix skills with the target platform
    // (writes .mcp.json for claude-code, .cursorrules for cursor, etc.)
    // D8.α.7 (Agent Ecosystem) wires the actual platform integration.
    void csf;
  },

  async onDeactivate(csf: CanonicalSkillFormat): Promise<void> {
    // agent-binding deactivate unregisters from the platform.
    void csf;
  },
};
