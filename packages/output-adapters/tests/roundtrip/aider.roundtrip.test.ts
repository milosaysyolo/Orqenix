// SPDX-License-Identifier: Apache-2.0
import { describe, it } from "vitest";
import { assertRoundTrip } from "@orqenix/normalization-engine";
import { aiderInputAdapter } from "@orqenix/input-adapters";
import { aiderOutputAdapter } from "../../src/aider";

const FIXTURES = [
  `aider_version: '>=0.40.0'\nname: my-aider-plugin\nversion: 1.0.0\ndescription: An aider plugin\nentry: ./plugin.py`,
];

describe("Round-trip: aider", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      await assertRoundTrip(FIXTURES[i] as string, aiderInputAdapter, aiderOutputAdapter, {
        path: "aider_plugin.yaml",
      });
    });
  }
});
