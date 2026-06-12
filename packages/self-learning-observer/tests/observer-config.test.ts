// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-observer , Per-scope config tests

import { describe, it, expect } from 'vitest';
import { ObserverConfigSchema } from '../src/types';

describe('ObserverConfigSchema', () => {
  it('accepts valid per-scope config', () => {
    const result = ObserverConfigSchema.safeParse({
      scopeId: 'proj_orqenix',
      enabled: true,
      piiFilter: 'basic',
      samplingRate: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it('uses defaults for optional fields', () => {
    const result = ObserverConfigSchema.parse({ scopeId: 'proj_test' });
    expect(result.enabled).toBe(true);
    expect(result.piiFilter).toBe('basic');
    expect(result.samplingRate).toBe(1.0);
  });

  it('rejects invalid sampling rate', () => {
    const result = ObserverConfigSchema.safeParse({
      scopeId: 'proj_test',
      samplingRate: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing scopeId', () => {
    const result = ObserverConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
