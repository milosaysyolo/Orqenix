// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { invoke } from '../src/index';

describe('bge-embedding reference plugin', () => {
  it('generates a 384-dim embedding', async () => {
    const result = await invoke({ text: 'hello world' });
    expect(result.dimension).toBe(384);
    expect(result.embedding).toHaveLength(384);
  });

  it('generates deterministic embeddings for same input', async () => {
    const a = await invoke({ text: 'test' });
    const b = await invoke({ text: 'test' });
    expect(a.embedding).toEqual(b.embedding);
  });

  it('generates different embeddings for different inputs', async () => {
    const a = await invoke({ text: 'foo' });
    const b = await invoke({ text: 'bar' });
    expect(a.embedding).not.toEqual(b.embedding);
  });
});
