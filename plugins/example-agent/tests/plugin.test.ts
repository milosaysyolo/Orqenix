// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { run } from '../src/index';

describe('example-agent reference plugin', () => {
  it('executes the orchestration workflow', async () => {
    const result = await run({ task: 'fix lint errors' });
    expect(result.completed).toBe(true);
    expect(result.steps).toHaveLength(4);
  });
});
