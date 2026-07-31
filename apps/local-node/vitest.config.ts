// SPDX-License-Identifier: Apache-2.0
import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../vitest.config.shared";

const localConfig = defineConfig({
  test: {
    // e2e spawns real mesh nodes; flaky in CI (port/process contention).
    // Run explicitly by targeting the file directly.
    exclude: ["test/e2e.integration.test.ts"],
  },
});

export default mergeConfig(shared, localConfig);
