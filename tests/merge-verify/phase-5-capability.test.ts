// SPDX-License-Identifier: Apache-2.0
// PHASE 5 SMOKE: capability token / permission model (merged into plugin-core).

import { describe, it, expect } from 'vitest';
import { PermissionChecker, STANDARD_PERMISSIONS, validatePermissions } from '@orqenix/plugin-core';

describe('PHASE 5 — Capability / Permission Model', () => {
  it('standard permissions catalog is present', () => {
    expect(Object.keys(STANDARD_PERMISSIONS).length).toBeGreaterThanOrEqual(19);
    expect(STANDARD_PERMISSIONS.SCOPE_READ).toBe('scope.read');
  });

  it('permission checker enforces exact + prefix matching', () => {
    const checker = new PermissionChecker(['scope.read', 'fs.read:/home/milo']);
    expect(checker.has('scope.read')).toBe(true);
    expect(checker.has('fs.read:/home/milo/project')).toBe(true);
    expect(checker.has('fs.read:/etc')).toBe(false);
  });

  it('permission format validation works', () => {
    expect(validatePermissions(['scope.read', 'git.write']).valid).toBe(true);
    expect(validatePermissions(['BadFormat']).valid).toBe(false);
  });
});
