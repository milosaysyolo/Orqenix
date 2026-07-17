// SPDX-License-Identifier: Apache-2.0
import { defineConfig, mergeConfig } from 'vitest/config';
import { resolve } from 'node:path';
import shared from '../../vitest.config.shared';

const localConfig = defineConfig({
  test: {
    root: resolve(import.meta.dirname),
    include: ['test/**/*.test.ts'],
  },
});

export default mergeConfig(shared, localConfig);
