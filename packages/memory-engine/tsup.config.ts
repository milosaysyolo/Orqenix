// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "migrations/index": "src/migrations/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  external: ["better-sqlite3", "sqlite-vec"],
  banner: {
    js: "// @orqenix/memory-engine , Apache-2.0 , https://orqenix.dev",
  },
});
