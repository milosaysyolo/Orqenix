import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { name: 'rtk-hooks', include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 15_000 } });
