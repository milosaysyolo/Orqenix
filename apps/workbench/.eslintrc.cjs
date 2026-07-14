// SPDX-License-Identifier: Apache-2.0

module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  rules: {
    // Workbench is OSS; no Proprietary dependencies allowed
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@orqenix-cloud/*',
            message: 'Workbench is OSS Apache-2.0. Do not import @orqenix-cloud/* (Proprietary).',
          },
        ],
        patterns: ['@orqenix-cloud/*'],
      },
    ],
    'react/no-unescaped-entities': 'off',
    // demo-store is the graceful fallback mock; explicit any is acceptable there.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  parserOptions: {
    project: './tsconfig.json',
  },
};
