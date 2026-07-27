// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import pkg from "../package.json";
import { activate, deactivate, targetPlatform } from "../src/index";

describe("claude-code-binding-ref reference plugin", () => {
  it("is Apache-2.0 (Anti-pattern 41: no vendor lock-in)", () => {
    expect(pkg.license).toBe("Apache-2.0");
  });

  it("declares target platform", () => {
    expect(targetPlatform).toBe("claude-code");
    expect(pkg.orqenixPlugin.keywords).toContain("claude-code");
  });

  it("activate returns config path", async () => {
    const result = await activate({ projectPath: "/proj" });
    expect(result.ok).toBe(true);
    expect(result.configWritten).toContain(".mcp.json");
  });

  it("deactivate succeeds", async () => {
    const result = await deactivate({ projectPath: "/proj" });
    expect(result.ok).toBe(true);
  });
});
