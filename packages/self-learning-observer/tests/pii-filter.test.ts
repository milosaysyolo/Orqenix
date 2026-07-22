// SPDX-License-Identifier: Apache-2.0
// @orqenix/self-learning-observer , PII filter tests

import { describe, it, expect } from 'vitest';
import { BasicPiiFilter } from '../src/types';

describe('BasicPiiFilter', () => {
  const filter = new BasicPiiFilter();

  // ── Patterns that ARE redacted ─────────────────────────────────

  it('redacts email addresses from payload values', () => {
    const result = filter.redact({ message: 'Contact me at user@example.com' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:email]');
  });

  it('redacts multiple emails in same payload', () => {
    const result = filter.redact({
      to: 'alice@foo.com',
      cc: 'bob@bar.org',
    });
    expect(result.applied).toBe(true);
    const json = JSON.stringify(result.redacted);
    expect(json).toContain('[REDACTED:email]');
    // Both original emails should be gone
    expect(json).not.toContain('alice@foo.com');
    expect(json).not.toContain('bob@bar.org');
  });

  it('redacts API tokens (sk- prefix)', () => {
    const result = filter.redact({ key: 'sk-abcdefghijklmnopqrstuvwxyz123456' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:token]');
  });

  it('redacts GitHub tokens (ghp- prefix)', () => {
    const result = filter.redact({ token: 'ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:token]');
  });

  it('redacts Slack tokens (xoxb- prefix)', () => {
    const result = filter.redact({ bot_token: 'xoxb-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:token]');
  });

  it('redacts home paths (/Users/...)', () => {
    const result = filter.redact({ path: '/Users/alice/project/src/index.ts' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:home-path]');
  });

  it('redacts /home/ paths', () => {
    const result = filter.redact({ cwd: '/home/bob/work' });
    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.redacted)).toContain('[REDACTED:home-path]');
  });

  // ── Patterns NOT redacted (known gaps) ─────────────────────────

  it('does NOT redact phone numbers', () => {
    const payload = { phone: '+1 (555) 123-4567' };
    const result = filter.redact(payload);
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual(payload);
  });

  it('does NOT redact IP addresses', () => {
    const payload = { ip: '192.168.1.1' };
    const result = filter.redact(payload);
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual(payload);
  });

  it('does NOT redact SSNs', () => {
    const payload = { ssn: '123-45-6789' };
    const result = filter.redact(payload);
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual(payload);
  });

  // ── False-positive safety ──────────────────────────────────────

  it('does NOT redact plain text containing "contact us at our office"', () => {
    const payload = { note: 'For questions contact us at our office during business hours.' };
    const result = filter.redact(payload);
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual(payload);
  });

  it('does NOT redact domain-only mentions (no @ sign)', () => {
    const payload = { url: 'Visit example.com for more info' };
    const result = filter.redact(payload);
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual(payload);
  });

  it('does NOT redact ordinary Unix paths outside /home/ and /Users/', () => {
    const payload = { path: '/etc/hosts' };
    const result = filter.redact(payload);
    expect(result.applied).toBe(false);
    expect(result.redacted).toEqual(payload);
  });

  // ── Edge cases ─────────────────────────────────────────────────

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

  it('includes notes when redaction applied', () => {
    const result = filter.redact({ msg: 'hi@test.com' });
    expect(result.applied).toBe(true);
    expect(result.notes).toBeDefined();
    expect(result.notes).toContain('email');
  });

  it('does not include notes when no redaction', () => {
    const result = filter.redact({ msg: 'hello world' });
    expect(result.applied).toBe(false);
    expect(result.notes).toBeUndefined();
  });
});
