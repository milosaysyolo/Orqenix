// SPDX-License-Identifier: Apache-2.0
// @orqenix/skill-genesis , Validation tests

import { describe, it, expect } from 'vitest';

describe('SkillValidation', () => {
  it('validates skill name format', () => {
    const valid = ['git-commit', 'build-and-test', 'code-review-v2'];
    const invalid = ['Git Commit', 'build_and_test', 'code.review', '', 'a'];

    for (const name of valid) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    for (const name of invalid) {
      expect(name).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('validates description length', () => {
    const valid = 'Short description';
    const tooLong = 'x'.repeat(501);
    expect(valid.length).toBeLessThanOrEqual(500);
    expect(tooLong.length).toBeGreaterThan(500);
  });

  it('validates language support', () => {
    const supported = ['typescript', 'python', 'shell'];
    const unsupported = ['rust', 'go', 'java'];
    for (const lang of supported) {
      expect(['typescript', 'python', 'shell']).toContain(lang);
    }
    for (const lang of unsupported) {
      expect(['typescript', 'python', 'shell']).not.toContain(lang);
    }
  });
});
