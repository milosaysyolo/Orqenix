import { describe, it, expect } from 'vitest';
import { containsLeak, redact, summarizePayload } from '../src/redaction.js';

describe('redaction', () => {
  it('summarizePayload returns size and 64-hex BLAKE3', () => {
    const s = summarizePayload(new Uint8Array([1, 2, 3, 4]));
    expect(s?.payloadSize).toBe(4);
    expect(s?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('redact drops forbidden field names', () => {
    const r = redact({
      capability: 'eyJhb...',
      token: 'secret-token',
      sig: 'AAAA',
      keep: 'me',
    }) as Record<string, unknown>;
    expect(r.capability).toBe('[redacted]');
    expect(r.token).toBe('[redacted]');
    expect(r.sig).toBe('[redacted]');
    expect(r.keep).toBe('me');
  });

  it('redact converts Uint8Array values to a payload summary', () => {
    const r = redact({ data: new Uint8Array([9, 9, 9]) }) as Record<string, { payloadSize: number }>;
    expect(r.data.payloadSize).toBe(3);
  });

  it('containsLeak flags raw long base64-like strings', () => {
    const longB64 = 'A'.repeat(200);
    expect(containsLeak(JSON.stringify({ x: longB64 }))).toBe(true);
  });

  it('containsLeak does NOT flag legitimate payloadHash (64 hex)', () => {
    expect(containsLeak(JSON.stringify({ payloadHash: 'a'.repeat(64) }))).toBe(false);
  });

  it('containsLeak flags explicit token field with raw value', () => {
    expect(containsLeak('{"capability":"raw-value"}')).toBe(true);
    expect(containsLeak('{"capability":"[redacted]"}')).toBe(false);
  });
});
