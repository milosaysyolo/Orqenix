// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "csf-schema": "src/csf-schema.ts",
    "kinds/registry": "src/kinds/registry.ts",
    "sandbox/index": "src/sandbox/sandbox-manager.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  banner: {
    js: "// @orqenix/plugin-core , Apache-2.0 , https://orqenix.dev",
  },
});
