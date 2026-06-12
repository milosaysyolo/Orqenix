// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Kind 8: code-analyzer
//
// Parse and analyze code in specific languages (Tree-sitter, language-specific).

import type { CanonicalSkillFormat } from '../csf-schema';
import type { PluginKindHandler, ValidationResult } from '../types';

export const codeAnalyzerHandler: PluginKindHandler<'code-analyzer'> = {
  kind: 'code-analyzer',
  description:
    'Parses and analyzes code in specific languages (Tree-sitter, language-specific analyzers).',

  validateManifest(csf: CanonicalSkillFormat): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!csf.manifest.tool) {
      errors.push(
        'code-analyzer plugins MUST declare manifest.tool with analyze(file) signature'
      );
    }

    // code-analyzer should declare which languages it handles via keywords
    const languageKeywords = csf.manifest.keywords.filter((k) =>
      ['python', 'javascript', 'typescript', 'go', 'rust', 'java', 'c', 'cpp', 'ruby', 'php', 'swift', 'kotlin'].includes(
        k.toLowerCase()
      )
    );
    if (languageKeywords.length === 0) {
      warnings.push(
        'code-analyzer plugins should declare supported language(s) via keywords (e.g., "python", "rust")'
      );
    }

    // Needs fs.read to read source files
    if (!csf.manifest.permissions.some((p) => p.startsWith('fs.read'))) {
      warnings.push(
        "code-analyzer plugins typically need 'fs.read' permission to read source files"
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  },
};
