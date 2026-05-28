import { describe, it, expect } from "vitest";
import {
  parseVersion,
  compareVersions,
  detectConflicts,
  createLockfile,
  addPin,
} from "../src/index.js";

describe("plugin-versioning integration", () => {
  it("rejects malformed semver", () => {
    expect(() => parseVersion("not-a-version")).toThrow(/Invalid semver/);
  });

  it("treats prerelease as lower than stable", () => {
    expect(compareVersions("1.0.0-alpha", "1.0.0")).toBeLessThan(0);
  });

  it("detectConflicts returns empty for empty input", () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it("lockfile preserves source field", () => {
    const lock = createLockfile();
    addPin(lock, "x", "1.0.0", "sha1", "marketplace-a");
    expect(lock.pins.x?.source).toBe("marketplace-a");
  });
});
