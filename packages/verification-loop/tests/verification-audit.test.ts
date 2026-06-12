// SPDX-License-Identifier: Apache-2.0
// @orqenix/verification-loop , verification-audit tests
import { describe, it, expect } from 'vitest';
import { VERIFICATION_AUDIT_KIND } from '../src/verification-audit';
describe('verification-audit', () => {
  it('exports audit kind constant', () => {
    expect(VERIFICATION_AUDIT_KIND).toBe('skill.verified');
  });
});
