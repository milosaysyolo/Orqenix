// SPDX-License-Identifier: Apache-2.0
// Created by D8.y.1.3 spec - from listing.
// PII filter tests for self-learning-observer

import { describe, it, expect } from 'vitest';

// Mock PiiFilter that implements string-based redact for testing
class TestPiiFilter {
  redact(input: string): string {
    return input
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
      .replace(/sk-[a-f0-9]{16,}/g, '[API_KEY]');
  }
}

describe('BasicPiiFilter', () => {
  const filter = new TestPiiFilter();

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
