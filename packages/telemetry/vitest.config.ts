// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    name: "telemetry",
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 5_000,
  },
});
