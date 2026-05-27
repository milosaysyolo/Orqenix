import { describe, it, expect } from "vitest";
import { parseVersion, compareVersions, isCompatible } from "../src/index.js";

describe("semver", () => {
  it("parses basic version", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("parses prerelease", () => {
    expect(parseVersion("1.0.0-alpha.1").prerelease).toBe("alpha.1");
  });

  it("compareVersions orders correctly", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("isCompatible enforces same major", () => {
    expect(isCompatible("1.5.0", "1.2.0")).toBe(true);
    expect(isCompatible("2.0.0", "1.0.0")).toBe(false);
  });

  it("isCompatible rejects downgrade within major", () => {
    expect(isCompatible("1.2.0", "1.5.0")).toBe(false);
  });
});
