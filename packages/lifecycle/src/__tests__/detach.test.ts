import { describe, it, expect } from "vitest";
import { applyFencedBlock, removeFencedBlock } from "../detach/fenced-block";

describe("fenced-block", () => {
  it("should apply fenced block to empty file", () => {
    const original = "";
    const result = applyFencedBlock(original, "console.log('test')");
    expect(result).toContain(">>> orqenix managed");
    expect(result).toContain("console.log('test')");
  });

  it("should replace existing fenced block", () => {
    const original = `# >>> orqenix managed (do not edit) >>>
old content
# <<< orqenix managed <<<`;
    const result = applyFencedBlock(original, "new content");
    expect(result).toContain("new content");
    expect(result).not.toContain("old content");
  });

  it("should remove fenced block", () => {
    const content = `# >>> orqenix managed (do not edit) >>>
managed content
# <<< orqenix managed <<<`;
    const result = removeFencedBlock(content);
    expect(result).not.toContain("managed content");
    expect(result).not.toContain(">>> orqenix managed");
  });

  it("should preserve content outside fence", () => {
    const original = `user code
# >>> orqenix managed (do not edit) >>>
managed
# <<< orqenix managed <<<
more user code`;
    const result = removeFencedBlock(original);
    expect(result).toContain("user code");
    expect(result).toContain("more user code");
    expect(result).not.toContain("managed");
  });

  it("should handle multiline payload", () => {
    const original = "";
    const payload = `line1
line2
line3`;
    const result = applyFencedBlock(original, payload);
    expect(result).toContain("line1");
    expect(result).toContain("line2");
    expect(result).toContain("line3");
  });
});
