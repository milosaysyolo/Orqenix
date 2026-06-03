// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "plugin-compress-context",
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
});
