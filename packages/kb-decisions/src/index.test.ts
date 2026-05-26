import { describe, it, expect } from "vitest";
import { DecisionKB } from "./index";

describe("kb-decisions", () => {
  it("exports DecisionKB class", () => {
    expect(typeof DecisionKB).toBe("function");
  });

  it("DecisionKB exposes static open", () => {
    expect(typeof DecisionKB.open).toBe("function");
  });
});
