import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@orqenix/memory-engine': resolve(__dirname, '../../packages/memory-engine/dist/index.js'),
      '@orqenix/self-learning-observer': resolve(__dirname, '../../packages/self-learning-observer/dist/index.js'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    root: __dirname,
    include: ['tests/**/*.test.ts'],
  },
});