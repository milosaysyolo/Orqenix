import { describe, it, expect } from "vitest";
import { parseRange, bumpRule } from "../version/semver";

describe("semver", () => {
  it("should parse valid semver range", () => {
    const range = parseRange("^1.0.0");
    expect(range.raw).toBe("^1.0.0");
  });

  it("should satisfy version in range", () => {
    const range = parseRange("^1.0.0");
    expect(range.satisfies("1.2.3")).toBe(true);
    expect(range.satisfies("2.0.0")).toBe(false);
  });

  it("should throw on invalid range", () => {
    expect(() => parseRange("invalid")).toThrow();
  });

  it("should determine bump rule for edit_prompt", () => {
    expect(bumpRule("edit_prompt")).toBe("patch");
  });

  it("should determine bump rule for major changes", () => {
    expect(bumpRule("change_required_input")).toBe("major");
  });
});
