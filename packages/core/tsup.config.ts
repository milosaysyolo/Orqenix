import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/scope/index.ts",
    "src/config/index.ts",
    "src/storage/index.ts",
    "src/sync/index.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "node20",
});
