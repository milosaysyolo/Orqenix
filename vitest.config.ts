import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readdirSync, readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

function buildWorkspaceAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  const packagesDir = resolve(rootDir, "packages");
  for (const pkg of readdirSync(packagesDir)) {
    try {
      const pkgJsonPath = resolve(packagesDir, pkg, "package.json");
      if (!existsSync(pkgJsonPath)) continue;
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
      if (!pkgJson.name) continue;
      const distJs = resolve(packagesDir, pkg, "dist", "index.js");
      if (existsSync(distJs)) {
        aliases[pkgJson.name] = distJs;
      }
    } catch {
      // skip unreadable packages
    }
  }
  return aliases;
}

export default defineConfig({
  resolve: {
    alias: {
      ...buildWorkspaceAliases(),
      '@mongodb-js/zstd': resolve(__dirname, '__mocks__/@mongodb-js/zstd.js'),
    },
  },
  optimizeDeps: {
    include: ["@noble/hashes/blake3", "@noble/hashes", "jsonc-parser"],
  },
  test: {
    globals: false,
    environment: "node",
    root: rootDir,
    retry: 2,
    include: ["packages/*/test/**/*.test.ts", "packages/*/tests/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/merge-verify/**", "scripts/cleanup/**", "apps/local-node/test/**", "packages/plugin-ecosystem/test/**"],
    reporters: ["default", resolve(rootDir, "scripts/vitest-charter-reporter.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/dist/**", "**/test/**", "**/bench/**"],
    },
    server: {
      deps: {
        inline: [/@noble\/hashes/, /jsonc-parser/],
      },
    },
  },
});
