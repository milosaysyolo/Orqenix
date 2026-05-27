import { describe, it, expect } from "vitest";
import { createLockfile, addPin, verifyPin, diffLockfiles } from "../src/index.js";

describe("lockfile pin", () => {
  it("creates empty lockfile", () => {
    const lock = createLockfile();
    expect(Object.keys(lock.pins)).toHaveLength(0);
  });

  it("addPin records entry", () => {
    const lock = createLockfile();
    addPin(lock, "x", "1.0.0", "sha1", "src");
    expect(lock.pins.x?.sha).toBe("sha1");
  });

  it("verifyPin matches sha", () => {
    const lock = createLockfile();
    addPin(lock, "x", "1.0.0", "sha1", "src");
    expect(verifyPin(lock, "x", "sha1")).toBe(true);
    expect(verifyPin(lock, "x", "sha2")).toBe(false);
  });

  it("diffLockfiles reports added removed changed", () => {
    const a = createLockfile();
    addPin(a, "keep", "1.0.0", "sha1", "src");
    addPin(a, "remove", "1.0.0", "sha2", "src");
    const b = createLockfile();
    addPin(b, "keep", "1.0.0", "sha1", "src");
    addPin(b, "add", "1.0.0", "sha3", "src");
    addPin(b, "remove", "1.1.0", "sha4", "src");
    const d = diffLockfiles(a, b);
    expect(d.added).toEqual(["add"]);
    expect(d.changed).toEqual(["remove"]);
    expect(d.removed).toEqual([]);
  });
});
