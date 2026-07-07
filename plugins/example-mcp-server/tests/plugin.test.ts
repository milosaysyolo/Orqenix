// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { echo, mcpServer } from "../src/index";

describe("example-mcp-server reference plugin", () => {
  it("echoes input", async () => {
    const result = await echo({ message: "hi" });
    expect(result.echoed).toBe("echo: hi");
  });

  it("declares mcp server metadata", () => {
    expect(mcpServer.name).toBe("example-echo-server");
    expect(mcpServer.transport).toBe("stdio");
    expect(mcpServer.tools).toHaveLength(1);
  });
});
