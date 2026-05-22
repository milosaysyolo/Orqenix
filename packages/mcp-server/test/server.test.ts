import { describe, it, expect } from "vitest";
import { OrqenixMcpServer } from "../src/index.js";

describe("OrqenixMcpServer", () => {
  it("constructs without throwing", () => {
    expect(() => new OrqenixMcpServer({ cwd: process.cwd() })).not.toThrow();
  });
});
