// SPDX-License-Identifier: Apache-2.0
// Shared vitest config that forces native binding resolution to use the
// hoisted node_modules path. Updated with env override for child processes.

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname);

export default defineConfig({
  test: {
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false,
        execArgv: [],
      },
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
    root: workspaceRoot,
    bail: 3,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
