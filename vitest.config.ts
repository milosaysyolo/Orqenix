import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["packages/*/test/**/*.test.ts"],
    reporters: [
      "default",
      resolve(__dirname, "scripts/vitest-charter-reporter.ts"),
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/dist/**", "**/test/**", "**/bench/**"],
    },
  },
});
