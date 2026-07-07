// SPDX-License-Identifier: Apache-2.0
import { describe, it } from "vitest";
import { assertRoundTrip } from "@orqenix/normalization-engine";
import { cursorInputAdapter } from "@orqenix/input-adapters";
import { cursorOutputAdapter } from "../../src/cursor";

const FIXTURES = [
  `You are an expert TypeScript developer.\nAlways use strict mode.\nPrefer functional patterns.`,
  `# Project rules\n- Use pnpm workspaces\n- Run tests before commit\n- Follow Conventional Commits`,
  `Be concise. Write idiomatic code. Add JSDoc to public APIs.`,
];

describe("Round-trip: cursor", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    it(`fixture ${i + 1} round-trips byte-identical`, async () => {
      // cursor input needs a .cursorrules path hint for detection, but parse works on content
      await assertRoundTrip(FIXTURES[i] as string, cursorInputAdapter, cursorOutputAdapter, {
        path: ".cursorrules",
      });
    });
  }
});
