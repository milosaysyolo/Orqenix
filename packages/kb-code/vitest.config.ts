import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "src/__tests__/**/*.test.ts"],
    globals: false,
    environment: "node",
    testTimeout: 15000,
    server: {
      deps: {
        external: [/web-tree-sitter/],
      },
    },
  },
});
