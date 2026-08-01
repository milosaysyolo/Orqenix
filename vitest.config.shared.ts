// SPDX-License-Identifier: Apache-2.0
// Shared vitest config that forces native binding resolution to use the
// hoisted node_modules path. Updated with env override for child processes.
//
// IMPORTANT: no `root` is set here. Each package's vitest.config.ts extends
// this and vitest defaults root to the config file's directory, so package
// test runs are scoped to that package only. Setting root to the workspace
// root here made every package re-run the ENTIRE workspace test suite.

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname);

export default defineConfig({
  test: {
    setupFiles: [resolve(import.meta.dirname, './vitest.setup.native-mocks.ts')],
    // Workspace packages appear as symlinks in node_modules; don't re-run their tests
    exclude: ["**/node_modules/**", "**/dist/**"],
    pool: 'forks',
    forks: {
      singleFork: false,
      execArgv: [],
    },
    server: {
      deps: {
        external: [/better-sqlite3/, /esbuild/, /@swc\/core/, /bindings/],
        inline: [],
      },
    },
    env: {
      NODE_PATH: resolve(workspaceRoot, "node_modules"),
    },
    bail: 3,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
