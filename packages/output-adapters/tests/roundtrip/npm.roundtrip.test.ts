// SPDX-License-Identifier: Apache-2.0
import { describe, it } from "vitest";
import { assertRoundTrip } from "@orqenix/normalization-engine";
import { npmInputAdapter } from "@orqenix/input-adapters";
import { npmOutputAdapter } from "../../src/npm";

const FIXTURES = [
  JSON.stringify(
    {
      name: "@example/git-commit",
      version: "1.2.0",
      description: "Conventional commits",
      license: "Apache-2.0",
      main: "./dist/plugin.js",
      keywords: ["git", "orqenix-plugin"],
      orqenixPlugin: {
        manifestVersion: "1.0",
        kind: "skill",
        compatibility: { orqenix: ">=0.8.0" },
        permissions: ["git.write"],
        external_agent_compat: ["claude-code", "cursor"],
        tool: {
          name: "git_commit",
          description: "Creates commit",
          inputSchema: { type: "object" },
        },
        sandboxMode: "separate_process",
      },
    },
    null,
    2,
  ),
];

describe("Round-trip: npm (canonical lossless)", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      await assertRoundTrip(FIXTURES[i] as string, npmInputAdapter, npmOutputAdapter);
    });
  }
});
