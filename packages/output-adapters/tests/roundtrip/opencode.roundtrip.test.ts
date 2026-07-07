// SPDX-License-Identifier: Apache-2.0
import { describe, it } from "vitest";
import { assertRoundTrip } from "@orqenix/normalization-engine";
import { opencodeInputAdapter } from "@orqenix/input-adapters";
import { opencodeOutputAdapter } from "../../src/opencode";

const FIXTURES = [
  `agentcli: true\nname: test-agent\nversion: 1.0.0\ndescription: A test agent\npermissions:\n  - scope.read`,
  `agentcli: true\nname: reviewer\nversion: 0.2.0\ndescription: Code reviewer`,
];

describe("Round-trip: opencode", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      await assertRoundTrip(FIXTURES[i] as string, opencodeInputAdapter, opencodeOutputAdapter, {
        path: ".opencode/agents/x.yaml",
      });
    });
  }
});
