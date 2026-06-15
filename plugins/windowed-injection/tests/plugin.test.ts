// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { invoke } from '../src/index';

describe('windowed-injection reference plugin', () => {
  it('selects entries within token budget', async () => {
    const result = await invoke({
      ranked: [
        { id: 'a', content: 'short', score: 10 },
        { id: 'b', content: 'medium length text', score: 5 },
      ],
      tokenBudget: 10,
    });
    expect(result.selected.length).toBeGreaterThanOrEqual(1);
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it('hard-includes subagent returns even over budget', async () => {
    const result = await invoke({
      ranked: [
        { id: 'sub', content: 'subagent return is a very long content that should exceed budget', score: 5, isSubagentReturn: true },
      ],
      tokenBudget: 1,
    });
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0]!.id).toBe('sub');
  });

  it('sorts by score within same subagent status', async () => {
    const result = await invoke({
      ranked: [
        { id: 'low', content: 'a', score: 1 },
        { id: 'high', content: 'b', score: 10 },
      ],
      tokenBudget: 100,
    });
    expect(result.selected[0]!.id).toBe('high');
    expect(result.selected[1]!.id).toBe('low');
  });
});
