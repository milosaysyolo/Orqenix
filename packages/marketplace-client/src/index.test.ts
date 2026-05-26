import { describe, it, expect } from "vitest";
import { install, uninstall, verifySignature } from "./index";

describe("marketplace-client", () => {
  it("exports install function", () => {
    expect(typeof install).toBe("function");
  });

  it("exports uninstall function", () => {
    expect(typeof uninstall).toBe("function");
  });

  it("exports verifySignature function", () => {
    expect(typeof verifySignature).toBe("function");
  });
});
