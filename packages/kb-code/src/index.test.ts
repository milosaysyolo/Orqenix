import { describe, it, expect } from "vitest";
import { CodeKB, LANGS } from "./index";

describe("kb-code", () => {
  it("exports LANGS array", () => {
    expect(Array.isArray(LANGS)).toBe(true);
    expect(LANGS.length).toBeGreaterThan(0);
  });

  it("exports CodeKB class", () => {
    expect(typeof CodeKB).toBe("function");
  });

  it("CodeKB has required methods", () => {
    expect(typeof CodeKB.open).toBe("function");
  });
});
