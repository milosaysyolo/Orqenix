// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { invoke } from '../src/index';

describe('bge-reranker reference plugin', () => {
  it('ranks candidates by query overlap', async () => {
    const result = await invoke({
      query: 'hello world',
      candidates: [
        { id: 'a', text: 'hello world foo' },
        { id: 'b', text: 'goodbye world' },
        { id: 'c', text: 'nothing matches' },
      ],
    });
    expect(result.ranked[0]!.id).toBe('a');
    expect(result.ranked[1]!.id).toBe('b');
    expect(result.ranked[2]!.id).toBe('c');
  });

  it('returns empty ranked for empty candidates', async () => {
    const result = await invoke({ query: 'test', candidates: [] });
    expect(result.ranked).toEqual([]);
  });
});
