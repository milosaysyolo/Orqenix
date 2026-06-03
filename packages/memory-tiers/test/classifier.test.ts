import { describe, it, expect } from "vitest";
import { classifyInitialTier, inferTypeFromContent } from "../src/classifier";

describe("classifier", () => {
  it("observation always goes to working", () => {
    expect(classifyInitialTier("observation", 0.9)).toBe("working");
  });
  it("low confidence goes to working", () => {
    expect(classifyInitialTier("fact", 0.3)).toBe("working");
  });
  it("high-confidence skill goes to semantic", () => {
    expect(classifyInitialTier("skill", 0.9)).toBe("semantic");
  });
  it("mid-confidence skill goes to episodic", () => {
    expect(classifyInitialTier("skill", 0.6)).toBe("episodic");
  });
  it("high-confidence fact goes to episodic (not semantic at creation)", () => {
    expect(classifyInitialTier("fact", 0.95)).toBe("episodic");
  });
  it('infers preference from "I prefer"', () => {
    expect(inferTypeFromContent("I prefer Rust for runtime")).toBe("preference");
  });
  it('infers decision from "decided to"', () => {
    expect(inferTypeFromContent("We decided to use SQLite")).toBe("decision");
  });
  it('infers task from "need to"', () => {
    expect(inferTypeFromContent("I need to finish the migration script")).toBe("task");
  });
  it('infers learning from "learned"', () => {
    expect(inferTypeFromContent("Today I learned about BLAKE3")).toBe("learning");
  });
  it("falls back to observation on no match", () => {
    expect(inferTypeFromContent("The sky is blue")).toBe("observation");
  });
});
