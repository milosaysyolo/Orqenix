import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.d.ts', '**/*.d.cts', '**/*.d.mts', 'coverage/**', '.next/**'],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/dist/**'],
              message: 'Import from package entry point, not dist/.',
            },
          ],
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
