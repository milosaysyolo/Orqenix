import { describe, it, expect } from "vitest";
import { McpClientManager } from "../src/index.js";

describe("McpClientManager", () => {
  it("starts with empty tool list", () => {
    const m = new McpClientManager();
    expect(m.listTools()).toEqual([]);
  });

  it("throws when calling tool on unconnected server", async () => {
    const m = new McpClientManager();
    await expect(m.callTool("missing", "foo", {})).rejects.toThrow(/not connected/);
  });
});
