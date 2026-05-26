import { describe, it, expect } from "vitest";
import { chunkMarkdown, DocsKB } from "./index";

describe("kb-docs", () => {
  it("exports chunkMarkdown function", () => {
    expect(typeof chunkMarkdown).toBe("function");
  });

  it("exports DocsKB class", () => {
    expect(typeof DocsKB).toBe("function");
  });

  it("chunkMarkdown splits markdown by headings", () => {
    const md = "# Title\nContent\n## Section\nMore";
    const chunks = chunkMarkdown("test.md", md);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.heading).toContain("Title");
  });
});
