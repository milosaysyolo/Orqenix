// SPDX-License-Identifier: Apache-2.0
// Created by D8.y.1.3 spec - from listing.
// PII filter tests for self-learning-observer

import { describe, it, expect } from 'vitest';
import { BasicPiiFilter } from '../src/pii-filter';

describe('BasicPiiFilter', () => {
  const filter = new BasicPiiFilter();

  it('redacts email addresses', () => {
    const result = filter.redact('Contact me at user@example.com for info');
    expect(result).not.toContain('user@example.com');
    expect(result).toContain('[EMAIL]');
  });

  it('redacts API keys', () => {
    const result = filter.redact('sk-1234567890abcdef');
    expect(result).not.toContain('sk-1234567890abcdef');
  });

  it('passes through safe content', () => {
    const safe = 'git commit -m "fix bug in parser"';
    expect(filter.redact(safe)).toBe(safe);
  });

  it('handles empty string', () => {
    expect(filter.redact('')).toBe('');
  });
});
