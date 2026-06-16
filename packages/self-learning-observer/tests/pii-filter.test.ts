// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-observer , PII filter tests

import { describe, it, expect } from 'vitest';
import { BasicPiiFilter } from '../src/types';

describe('BasicPiiFilter', () => {
  const filter = new BasicPiiFilter();

  it('redacts email addresses from payload values', () => {
    const result = filter.redact({ message: 'Contact me at user@example.com' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:email]');
  });

  it('redacts API tokens from payload values', () => {
    const result = filter.redact({ key: 'sk-abcdefghijklmnopqrstuvwxyz123456' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:token]');
  });

  it('passes through safe content', () => {
    const payload = { action: 'git commit -m "fix bug"' };
    const result = filter.redact(payload);
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual(payload);
  });

  it('handles empty payload', () => {
    const result = filter.redact({});
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual({});
  });
});
