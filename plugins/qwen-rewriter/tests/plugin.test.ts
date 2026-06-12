// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { invoke } from '../src/index';

describe('qwen-rewriter reference plugin', () => {
  it('expands abbreviations in prompts', async () => {
    const result = await invoke({ prompt: 'fix auth fn in db cfg' });
    expect(result.rewritten).toBe('fix authentication function in database configuration');
  });

  it('returns trimmed prompt when no abbreviations match', async () => {
    const result = await invoke({ prompt: '  hello world  ' });
    expect(result.rewritten).toBe('hello world');
  });
});
