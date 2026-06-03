// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "compress-strategies",
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
  },
});
