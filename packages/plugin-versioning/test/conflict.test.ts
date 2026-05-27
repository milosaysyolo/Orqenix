import { describe, it, expect } from "vitest";
import { detectConflicts } from "../src/index.js";

describe("conflict detection", () => {
  it("no conflict when single pin", () => {
    expect(detectConflicts([{ name: "x", version: "1.0.0", source: "a" }])).toEqual([]);
  });

  it("no conflict when same version same source", () => {
    expect(
      detectConflicts([
        { name: "x", version: "1.0.0", source: "a" },
        { name: "x", version: "1.0.0", source: "a" },
      ])
    ).toEqual([]);
  });

  it("source-mismatch when different sources", () => {
    const r = detectConflicts([
      { name: "x", version: "1.0.0", source: "a" },
      { name: "x", version: "1.0.0", source: "b" },
    ]);
    expect(r[0]?.reason).toBe("source-mismatch");
  });

  it("major-mismatch when majors differ", () => {
    const r = detectConflicts([
      { name: "x", version: "1.0.0", source: "a" },
      { name: "x", version: "2.0.0", source: "a" },
    ]);
    expect(r[0]?.reason).toBe("major-mismatch");
  });

  it("version-downgrade when older pinned later", () => {
    const r = detectConflicts([
      { name: "x", version: "1.5.0", source: "a" },
      { name: "x", version: "1.2.0", source: "a" },
    ]);
    expect(r[0]?.reason).toBe("version-downgrade");
  });

  it("returns multiple conflicts", () => {
    const r = detectConflicts([
      { name: "x", version: "1.0.0", source: "a" },
      { name: "x", version: "2.0.0", source: "a" },
      { name: "y", version: "1.0.0", source: "a" },
      { name: "y", version: "1.0.0", source: "b" },
    ]);
    expect(r).toHaveLength(2);
  });
});
