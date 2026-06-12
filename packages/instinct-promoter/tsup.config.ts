// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: { index: 'src/index.ts', 'ui/index': 'src/ui/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: [
    '@orqenix/self-learning-detection',
    '@orqenix/self-learning-observer',
    '@orqenix/skill-genesis',
    '@orqenix/ui-primitives',
    'react',
    'react-dom',
  ],
  banner: { js: '// @orqenix/instinct-promoter , Apache-2.0 , https://orqenix.dev' },
});
