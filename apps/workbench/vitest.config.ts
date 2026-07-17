// SPDX-License-Identifier: Apache-2.0
import { defineConfig, mergeConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import shared from '../../vitest.config.shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(shared, defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    root: __dirname,
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));