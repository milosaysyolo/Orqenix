// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import pkg from '../package.json';
import { invoke } from '../src/index';

describe('test-runner-subagent reference plugin', () => {
  it('returns structured test result', async () => {
    const result = await invoke({ testPath: 'tests/' });
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('failed');
    expect(Array.isArray(result.failures)).toBe(true);
  });

  it('does NOT request memory.write (ADR-E-002: subagent no persistence)', () => {
    const perms = pkg.orqenixPlugin.permissions;
    expect(perms.some((p) => p.startsWith('memory.write'))).toBe(false);
  });

  it('declares outputSchema (parent absorbs return)', () => {
    expect(pkg.orqenixPlugin.tool.outputSchema).toBeDefined();
  });
});
