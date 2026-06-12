// SPDX-License-Identifier: Apache-2.0
import { describe, it } from 'vitest';
import { assertRoundTrip } from '@orqenix/normalization-engine';
import { continueInputAdapter } from '@orqenix/input-adapters';
import { continueOutputAdapter } from '../../src/continue';

const FIXTURES = [
  JSON.stringify({ name: 'my-provider', continueVersion: '0.8.0', models: [] }, null, 2),
];

describe('Round-trip: continue', () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      await assertRoundTrip(FIXTURES[i] as string, continueInputAdapter, continueOutputAdapter, {
        path: '.continue/config.json',
      });
    });
  }
});
