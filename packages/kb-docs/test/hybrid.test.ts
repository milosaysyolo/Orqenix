import { describe, it, expect } from "vitest";
import { hybridRank, gradeAndDiversify } from "../src/index.js";

describe("hybridRank", () => {
  it("merges fts only", () => {
    const out = hybridRank(
      [
        { id: "a", path: "p", title: "t", snippet: "", rank: -2 },
        { id: "b", path: "p", title: "t", snippet: "", rank: -1 },
      ],
      [],
      0.6
    );
    expect(out[0]?.id).toBe("a");
    expect(out[0]?.source).toBe("fts");
  });

  it("merges vec only", () => {
    const out = hybridRank([], [{ id: "a", distance: 0.1 }], 0.6);
    expect(out[0]?.source).toBe("vec");
  });

  it("merges overlapping fts + vec marks both", () => {
    const out = hybridRank(
      [{ id: "x", path: "p", title: "t", snippet: "", rank: -1 }],
      [{ id: "x", distance: 0.05 }],
      0.5
    );
    expect(out[0]?.source).toBe("both");
  });

  it("alpha=1 returns vec ordering", () => {
    const out = hybridRank(
      [
        { id: "a", path: "p", title: "t", snippet: "", rank: -10 },
        { id: "b", path: "p", title: "t", snippet: "", rank: -1 },
      ],
      [
        { id: "a", distance: 0.9 },
        { id: "b", distance: 0.1 },
      ],
      1
    );
    expect(out[0]?.id).toBe("b");
  });

  it("alpha=0 returns fts ordering", () => {
    const out = hybridRank(
      [
        { id: "a", path: "p", title: "t", snippet: "", rank: -10 },
        { id: "b", path: "p", title: "t", snippet: "", rank: -1 },
      ],
      [
        { id: "a", distance: 0.9 },
        { id: "b", distance: 0.1 },
      ],
      0
    );
    expect(out[0]?.id).toBe("a");
  });
});

describe("gradeAndDiversify", () => {
  it("filters below minScore", () => {
    const out = gradeAndDiversify(
      [
        { id: "1", path: "a/x", title: "", score: 0.5, source: "fts" },
        { id: "2", path: "b/y", title: "", score: 0.05, source: "fts" },
      ],
      { minScore: 0.1, diversityPenalty: 0 }
    );
    expect(out.map((h) => h.id)).toEqual(["1"]);
  });

  it("applies diversity penalty when paths share parent", () => {
    const out = gradeAndDiversify(
      [
        { id: "1", path: "a/x.md", title: "", score: 1, source: "fts" },
        { id: "2", path: "a/y.md", title: "", score: 0.9, source: "fts" },
      ],
      { minScore: 0, diversityPenalty: 0.5 }
    );
    expect(out[0]?.id).toBe("1");
    expect(out[1]?.score).toBeCloseTo(0.45);
  });
});
