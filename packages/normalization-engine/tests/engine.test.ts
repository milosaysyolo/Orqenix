// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { NormalizationEngine } from "../src/engine";
import { buildCsf } from "../src/csf-builder";
import {
  NoAdapterMatchError,
  AmbiguousMatchError,
  UnsupportedTargetError,
  type InputAdapter,
  type OutputAdapter,
  type ImportInput,
} from "../src/types";

function mockInputAdapter(
  kind: string,
  confidence: number,
  matchPredicate: (input: ImportInput) => boolean,
): InputAdapter {
  return {
    kind,
    version: "1.0.0",
    name: kind,
    async detect(input) {
      return { matched: matchPredicate(input), confidence };
    },
    async parse(input) {
      return buildCsf({
        name: `@test/${kind}`,
        version: "1.0.0",
        kind: "skill",
        importedFromKind: kind,
        normalizerVersion: "1.0.0",
        originalFormatPreserved: input.content ?? "",
      });
    },
  };
}

function mockOutputAdapter(kind: string, lossy: string[] = []): OutputAdapter {
  return {
    kind,
    version: "1.0.0",
    name: kind,
    async serialize(csf) {
      return {
        content: JSON.stringify({ name: csf.name }),
        format: "json",
      };
    },
    validateExportability() {
      return { lossyFields: lossy, warnings: [] };
    },
  };
}

describe("NormalizationEngine", () => {
  it("imports using explicit sourceKind", async () => {
    const engine = new NormalizationEngine({
      inputAdapters: [mockInputAdapter("claude-code", 0.9, () => true)],
      outputAdapters: [],
    });
    const result = await engine.import({ sourceKind: "claude-code", content: "x" });
    expect(result.adapter.kind).toBe("claude-code");
    expect(result.csf.name).toBe("@test/claude-code");
  });

  it("auto-detects the highest-confidence adapter", async () => {
    const engine = new NormalizationEngine({
      inputAdapters: [
        mockInputAdapter("cursor", 0.5, () => true),
        mockInputAdapter("claude-code", 0.95, () => true),
      ],
      outputAdapters: [],
    });
    const result = await engine.import({ content: "x" });
    expect(result.adapter.kind).toBe("claude-code");
  });

  it("throws NoAdapterMatchError when nothing matches", async () => {
    const engine = new NormalizationEngine({
      inputAdapters: [mockInputAdapter("x", 0.9, () => false)],
      outputAdapters: [],
    });
    await expect(engine.import({ content: "y" })).rejects.toBeInstanceOf(NoAdapterMatchError);
  });

  it("throws AmbiguousMatchError when top two tie", async () => {
    const engine = new NormalizationEngine({
      inputAdapters: [
        mockInputAdapter("a", 0.7, () => true),
        mockInputAdapter("b", 0.72, () => true),
      ],
      outputAdapters: [],
    });
    await expect(engine.import({ content: "z" })).rejects.toBeInstanceOf(AmbiguousMatchError);
  });

  it("does not flag ambiguity when one adapter is very confident (>=0.95)", async () => {
    const engine = new NormalizationEngine({
      inputAdapters: [
        mockInputAdapter("a", 0.96, () => true),
        mockInputAdapter("b", 0.9, () => true),
      ],
      outputAdapters: [],
    });
    const result = await engine.import({ content: "z" });
    expect(result.adapter.kind).toBe("a");
  });

  it("exports CSF to a target", async () => {
    const engine = new NormalizationEngine({
      inputAdapters: [],
      outputAdapters: [mockOutputAdapter("claude-code")],
    });
    const csf = buildCsf({
      name: "@test/skill",
      version: "1.0.0",
      kind: "skill",
      importedFromKind: "manual",
      normalizerVersion: "1.0.0",
      originalFormatPreserved: {},
    });
    const result = await engine.export(csf, "claude-code");
    expect(result.report.lossyFields).toEqual([]);
  });

  it("export surfaces lossy fields", async () => {
    const engine = new NormalizationEngine({
      inputAdapters: [],
      outputAdapters: [mockOutputAdapter("cursor", ["outputSchema", "license"])],
    });
    const csf = buildCsf({
      name: "@test/skill",
      version: "1.0.0",
      kind: "skill",
      importedFromKind: "manual",
      normalizerVersion: "1.0.0",
      originalFormatPreserved: {},
    });
    const result = await engine.export(csf, "cursor");
    expect(result.report.lossyFields).toEqual(["outputSchema", "license"]);
  });

  it("throws UnsupportedTargetError for unknown target", async () => {
    const engine = new NormalizationEngine({ inputAdapters: [], outputAdapters: [] });
    const csf = buildCsf({
      name: "@test/x",
      version: "1.0.0",
      kind: "skill",
      importedFromKind: "m",
      normalizerVersion: "1.0.0",
      originalFormatPreserved: {},
    });
    await expect(engine.export(csf, "nonexistent")).rejects.toBeInstanceOf(UnsupportedTargetError);
  });

  it("lists input + output adapters", () => {
    const engine = new NormalizationEngine({
      inputAdapters: [mockInputAdapter("a", 0.9, () => true)],
      outputAdapters: [mockOutputAdapter("b")],
    });
    expect(engine.listInputAdapters()).toEqual(["a"]);
    expect(engine.listOutputAdapters()).toEqual(["b"]);
  });
});
