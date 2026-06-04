import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Defense-in-depth retry while the underlying race is being root-caused.
    // Remove or lower to retry:1 once the race is eliminated at the source.
    retry: 3,

    // Run this package's tests single-threaded to eliminate cross-test
    // shared-state races (cache singleton, temp dir collisions).
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },

    // Cache operations can be slow under CI load; give them headroom.
    testTimeout: 15000,
    hookTimeout: 15000,

    // Ensure clean module state between test files
    isolate: true,
  },
});
