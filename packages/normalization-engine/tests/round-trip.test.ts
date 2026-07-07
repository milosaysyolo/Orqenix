// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { roundTrip, assertRoundTrip, normalizeWhitespace } from "../src/round-trip";
import { buildCsf, getOriginalFormat } from "../src/csf-builder";
import type { InputAdapter, OutputAdapter } from "../src/types";

// A faithful input+output adapter pair that preserves content via provenance
const faithfulInput: InputAdapter = {
  kind: "faithful",
  version: "1.0.0",
  name: "Faithful",
  async detect() {
    return { matched: true, confidence: 1 };
  },
  async parse(input) {
    return buildCsf({
      name: "@test/faithful",
      version: "1.0.0",
      kind: "skill",
      importedFromKind: "faithful",
      normalizerVersion: "1.0.0",
      originalFormatPreserved: input.content ?? "",
    });
  },
};

const faithfulOutput: OutputAdapter = {
  kind: "faithful",
  version: "1.0.0",
  name: "Faithful",
  async serialize(csf) {
    // Reconstruct from preserved original format → byte-identical round-trip
    const original = getOriginalFormat<string>(csf) ?? "";
    return { content: original, format: "text" };
  },
  validateExportability() {
    return { lossyFields: [], warnings: [] };
  },
};

describe("Round-trip fidelity", () => {
  it("normalizeWhitespace handles line endings + trailing space", () => {
    const input = "line1  \r\nline2\t\r\n\n\n\nline3   ";
    const normalized = normalizeWhitespace(input);
    expect(normalized).toBe("line1\nline2\n\nline3");
  });

  it("faithful adapter pair round-trips byte-identical", async () => {
    const original = "# My Skill\n\nThis is a skill definition.";
    const result = await roundTrip(original, faithfulInput, faithfulOutput);
    expect(result.identical).toBe(true);
    expect(result.firstDiffIndex).toBeNull();
  });

  it("assertRoundTrip passes for faithful pair", async () => {
    const original = "skill content";
    await expect(assertRoundTrip(original, faithfulInput, faithfulOutput)).resolves.toBeUndefined();
  });

  it("detects round-trip mismatch", async () => {
    const lossyOutput: OutputAdapter = {
      kind: "lossy",
      version: "1.0.0",
      name: "Lossy",
      async serialize() {
        return { content: "totally different content", format: "text" };
      },
      validateExportability() {
        return { lossyFields: ["everything"], warnings: [] };
      },
    };
    const result = await roundTrip("original content", faithfulInput, lossyOutput);
    expect(result.identical).toBe(false);
    expect(result.firstDiffIndex).not.toBeNull();
  });

  it("assertRoundTrip throws on mismatch with diff context", async () => {
    const lossyOutput: OutputAdapter = {
      kind: "lossy",
      version: "1.0.0",
      name: "Lossy",
      async serialize() {
        return { content: "wrong", format: "text" };
      },
      validateExportability() {
        return { lossyFields: [], warnings: [] };
      },
    };
    await expect(assertRoundTrip("right", faithfulInput, lossyOutput)).rejects.toThrow(
      /Round-trip fidelity failed/,
    );
  });

  it("round-trip ignores whitespace differences", async () => {
    const original = "line1\nline2";
    const wsOutput: OutputAdapter = {
      kind: "ws",
      version: "1.0.0",
      name: "WS",
      async serialize() {
        // Add trailing whitespace + extra blank lines (normalized away)
        return { content: "line1   \n\n\n\nline2  \n", format: "text" };
      },
      validateExportability() {
        return { lossyFields: [], warnings: [] };
      },
    };
    const result = await roundTrip(original, faithfulInput, wsOutput);
    expect(result.identical).toBe(true);
  });
});
