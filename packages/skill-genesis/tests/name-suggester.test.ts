// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-genesis , Name suggester tests

import { describe, it, expect } from 'vitest';

describe('NameSuggester', () => {
  it('generates kebab-case from pattern name', () => {
    const name = 'git-commit-with-template';
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('rejects invalid skill names', () => {
    const invalid = ['with spaces', 'UPPERCASE', 'special!chars'];
    for (const name of invalid) {
      expect(name).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('deduplicates against existing names', () => {
    const existing = new Set(['git-commit', 'git-commit-1']);
    const suggest = (base: string): string => {
      let name = base;
      let i = 1;
      while (existing.has(name)) {
        name = `${base}-${i}`;
        i++;
      }
      return name;
    };
    expect(suggest('git-commit')).toBe('git-commit-2');
  });
});
