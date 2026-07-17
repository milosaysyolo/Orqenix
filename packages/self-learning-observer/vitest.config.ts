import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdirSync, existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');

function buildWorkspaceAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  const packagesDir = resolve(rootDir, 'packages');
  for (const pkg of readdirSync(packagesDir)) {
    try {
      const pkgJsonPath = resolve(packagesDir, pkg, 'package.json');
      if (!existsSync(pkgJsonPath)) continue;
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      if (!pkgJson.name) continue;
      const distJs = resolve(packagesDir, pkg, 'dist', 'index.js');
      if (existsSync(distJs)) {
        aliases[pkgJson.name] = distJs;
      }
    } catch { /* skip */ }
  }
  return aliases;
}

export default defineConfig({
  resolve: {
    alias: buildWorkspaceAliases(),
  },
  test: {
    pool: 'forks',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    server: {
      deps: {
        external: [/better-sqlite3/],
      },
    },
  },
});
