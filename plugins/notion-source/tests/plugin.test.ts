// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { invoke } from "../src/index";

describe("notion-source reference plugin", () => {
  it("returns empty when no token configured", async () => {
    delete process.env.NOTION_TOKEN;
    const result = await invoke({ query: "test" });
    expect(result.entries).toEqual([]);
  });
});
