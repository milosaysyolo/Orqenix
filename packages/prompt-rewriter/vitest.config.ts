// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "prompt-rewriter",
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
});
