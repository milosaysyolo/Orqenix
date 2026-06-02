import { describe, it, expect } from 'vitest';
import { extractFromText, _PATTERN_COUNT } from '../src/extractor';

describe('extractor', () => {
  it('has at least 12 patterns covering all 8 types', () => {
    expect(_PATTERN_COUNT).toBeGreaterThanOrEqual(12);
  });

  it('extracts preference', () => {
    const c = extractFromText('I prefer Rust for runtime', 'ce:1');
    expect(c.some((x) => x.type === 'preference')).toBe(true);
  });

  it('extracts decision', () => {
    const c = extractFromText('We decided to use SQLite for storage', 'ce:1');
    expect(c.some((x) => x.type === 'decision' && x.confidence >= 0.85)).toBe(true);
  });

  it('extracts task with TODO marker', () => {
    const c = extractFromText('TODO: ship Part 5 by tomorrow', 'ce:1');
    expect(c.some((x) => x.type === 'task' && x.confidence >= 0.9)).toBe(true);
  });

  it('dedupes within one call', () => {
    const c = extractFromText('I prefer Rust. I prefer Rust.', 'ce:1');
    const prefs = c.filter((x) => x.type === 'preference');
    expect(prefs.length).toBe(1);
  });

  it('skips sentences shorter than 8 chars', () => {
    const c = extractFromText('I do.', 'ce:1');
    expect(c).toHaveLength(0);
  });

  it('attaches sourceEntryId', () => {
    const c = extractFromText('I learned BLAKE3 is fast', 'ce:42');
    expect(c[0].sourceEntryId).toBe('ce:42');
  });
});
