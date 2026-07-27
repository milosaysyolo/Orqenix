// SPDX-License-Identifier: Apache-2.0
import { describe, it } from "vitest";
import { assertRoundTrip } from "@orqenix/normalization-engine";
import { claudeCodeInputAdapter } from "@orqenix/input-adapters";
import { claudeCodeOutputAdapter } from "../../src/claude-code";

const FIXTURES = [
  `---\nskill: git-commit\ndescription: Conventional commits helper\n---\n# Git Commit\n\nCreates commits following Conventional Commits.`,
  `---\nskill: run-tests\ndescription: Test runner\npermissions:\n  - command.execute:limited\n---\n# Run Tests\n\nExecutes the test suite.`,
  `---\nskill: format-code\ndescription: Code formatter\n---\nFormat with prettier.`,
];

describe("Round-trip: claude-code", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      await assertRoundTrip(FIXTURES[i] as string, claudeCodeInputAdapter, claudeCodeOutputAdapter);
    });
  }
});
