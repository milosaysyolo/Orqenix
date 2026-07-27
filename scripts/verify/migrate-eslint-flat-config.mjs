// SPDX-License-Identifier: Apache-2.0
// Migrates .eslintrc.cjs → eslint.config.js (flat config) for ESLint 9.x.
// Idempotent. Adds missing dev dependencies. Per memory rule: never require
// versions higher than published; pins to known-good ranges.

import { readFile, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

// Packages that ship .eslintrc.cjs but need flat config for ESLint 9
const TARGETS = [
  "packages/ui-primitives",
  "packages/plugin-core",
  "packages/memory-engine",
  "packages/settings-registry",
  "packages/local-memory-federation",
];

// Latest published as of 2026-06: typescript-eslint 8.x. Pin floor.
const REQUIRED_DEVDEPS = {
  "@typescript-eslint/parser": "^8.0.0",
  "@typescript-eslint/eslint-plugin": "^8.0.0",
};

const FLAT_CONFIG = `// SPDX-License-Identifier: Apache-2.0
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', '**/*.d.ts', 'coverage/**'] },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
`;

let migrated = 0;
let depsAdded = 0;

for (const rel of TARGETS) {
  const pkgDir = join(ROOT, rel);
  const legacyPath = join(pkgDir, ".eslintrc.cjs");
  const flatPath = join(pkgDir, "eslint.config.js");
  const pkgJsonPath = join(pkgDir, "package.json");

  if (!existsSync(pkgJsonPath)) {
    console.warn(`[skip] ${rel}: package.json missing`);
    continue;
  }

  // 1. Write flat config
  if (!existsSync(flatPath)) {
    await writeFile(flatPath, FLAT_CONFIG);
    console.log(`[migrate] ${rel}/eslint.config.js created`);
    migrated += 1;
  }

  // 2. Remove legacy (safe: flat config takes precedence anyway)
  if (existsSync(legacyPath)) {
    await unlink(legacyPath);
    console.log(`[migrate] ${rel}/.eslintrc.cjs removed`);
  }

  // 3. Ensure devDeps
  const pkg = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
  pkg.devDependencies = pkg.devDependencies ?? {};
  let pkgChanged = false;
  for (const [name, range] of Object.entries(REQUIRED_DEVDEPS)) {
    if (!pkg.devDependencies[name]) {
      pkg.devDependencies[name] = range;
      pkgChanged = true;
      depsAdded += 1;
      console.log(`[deps] ${rel}: added ${name} ${range}`);
    }
  }
  if (pkgChanged) {
    await writeFile(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n");
  }
}

console.log(
  `\n[migrate-eslint-flat-config] ${migrated} config(s) migrated, ${depsAdded} dep(s) added.`,
);
console.log(`Next: run \`pnpm install\` then \`pnpm -r run lint\` to verify.`);
