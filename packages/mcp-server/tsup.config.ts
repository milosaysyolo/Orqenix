// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: [
    '@modelcontextprotocol/sdk',
    '@orqenix/memory-engine',
    '@orqenix/plugin-core',
    '@orqenix/skill-runtime',
    'better-sqlite3',
  ],
  banner: { js: '// @orqenix/mcp-server , Apache-2.0 , https://orqenix.dev' },
});
