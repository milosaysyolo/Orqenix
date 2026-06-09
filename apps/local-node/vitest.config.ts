import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 54 },
      include: ['src/config.ts', 'src/address-book.ts', 'src/identity-loader.ts', 'src/node.ts'],
      exclude: [],
    },
  },
});
