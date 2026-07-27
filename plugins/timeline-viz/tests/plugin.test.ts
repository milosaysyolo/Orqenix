// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { invoke } from "../src/index";

describe("timeline-viz reference plugin", () => {
  it("renders SVG with sorted entries", async () => {
    const result = await invoke({
      entries: [
        { id: "2", timestamp: "2026-01-02", label: "second" },
        { id: "1", timestamp: "2026-01-01", label: "first" },
      ],
    });
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("first");
    expect(result.svg).toContain("second");
  });

  it("returns valid SVG for empty entries", async () => {
    const result = await invoke({ entries: [] });
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
  });

  it("escapes XML special characters in labels", async () => {
    const result = await invoke({
      entries: [{ id: "1", timestamp: "2026-01-01", label: "a < b & c > d" }],
    });
    expect(result.svg).toContain("&lt;");
    expect(result.svg).toContain("&amp;");
    expect(result.svg).toContain("&gt;");
  });
});
