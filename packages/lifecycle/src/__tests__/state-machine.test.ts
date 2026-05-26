import { describe, it, expect } from "vitest";
import { canTransition, transition } from "../state-machine/transitions";

describe("state-machine transitions", () => {
  it("should allow ACTIVE -> STALE", () => {
    expect(canTransition("ACTIVE", "STALE")).toBe(true);
  });

  it("should allow STALE -> TRASH", () => {
    expect(canTransition("STALE", "TRASH")).toBe(true);
  });

  it("should allow TRASH -> PURGED", () => {
    expect(canTransition("TRASH", "PURGED")).toBe(true);
  });

  it("should allow STALE -> ACTIVE", () => {
    expect(canTransition("STALE", "ACTIVE")).toBe(true);
  });

  it("should reject invalid transitions", () => {
    expect(canTransition("ACTIVE", "TRASH")).toBe(false);
    expect(canTransition("PURGED", "ACTIVE")).toBe(false);
  });

  it("should throw on invalid transition", () => {
    expect(() => transition("ACTIVE", "TRASH")).toThrow();
  });
});
