import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { name: 'memory-tiers', include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 10_000 },
});
