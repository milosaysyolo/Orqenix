// SPDX-License-Identifier: Apache-2.0
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@orqenix-cloud/*",
              message:
                "Workbench is OSS Apache-2.0. Do not import @orqenix-cloud/* (Proprietary).",
            },
          ],
          patterns: ["@orqenix-cloud/*"],
        },
      ],
      "react/no-unescaped-entities": "off",
      // demo-store is the graceful fallback mock; explicit any is acceptable there.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
