// SPDX-License-Identifier: Apache-2.0
import { describe, it } from "vitest";
import { assertRoundTrip } from "@orqenix/normalization-engine";
import { codexInputAdapter } from "@orqenix/input-adapters";
import { codexOutputAdapter } from "../../src/codex";

const FIXTURES = [
  JSON.stringify(
    {
      schema_version: "gpt-export-v1",
      name: "Code Reviewer",
      description: "Reviews code",
      instructions: "Review for bugs.",
    },
    null,
    2,
  ),
  JSON.stringify(
    {
      schema_version: "gpt-export-v1",
      name: "Doc Writer",
      description: "Writes docs",
      instructions: "Generate docs.",
    },
    null,
    2,
  ),
];

describe("Round-trip: codex", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      await assertRoundTrip(FIXTURES[i] as string, codexInputAdapter, codexOutputAdapter);
    });
  }
});
