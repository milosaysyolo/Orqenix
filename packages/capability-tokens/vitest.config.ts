import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'capability-tokens',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
  },
});
