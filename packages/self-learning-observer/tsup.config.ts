// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "tsup";
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  external: ["@orqenix/memory-engine"],
  banner: { js: "// @orqenix/self-learning-observer , Apache-2.0 , https://orqenix.dev" },
});
