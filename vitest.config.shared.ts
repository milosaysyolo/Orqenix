// SPDX-License-Identifier: Apache-2.0
// Shared vitest config that forces native binding resolution to use the
// hoisted node_modules path, not pnpm's isolated .pnpm store.
//
// Each package imports + extends this:
//   import { defineConfig, mergeConfig } from 'vitest/config';
//   import shared from '../../vitest.config.shared';
//   export default mergeConfig(shared, defineConfig({ /* package-specific */ }));

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Critical: vitest forks/threads must inherit the workspace's hoisted
    // node_modules so better-sqlite3 binding resolves via the same path that
    // production runtime uses.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        execArgv: [],
      },
    },
    // Disable optimizeDeps for native deps so vitest doesn't try to bundle them
    server: {
      deps: {
        external: [/better-sqlite3/, /esbuild/, /@swc\/core/],
      },
    },
    // Vitest's default cwd is the package dir; set to workspace root for
    // consistent require.resolve behavior.
    root: process.cwd(),
    // Bail early on persistent infrastructure failures so we don't hit
    // the 10-min timeout reported in D8.verify-2.
    bail: 3,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
