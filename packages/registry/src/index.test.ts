import { describe, it, expect } from "vitest";
import { Registry } from "./index";

describe("registry", () => {
  it("exports Registry class", () => {
    expect(typeof Registry).toBe("function");
  });

  it("Registry exposes static open", () => {
    expect(typeof Registry.open).toBe("function");
  });
});
