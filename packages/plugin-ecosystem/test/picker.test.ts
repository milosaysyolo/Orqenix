import { describe, it, expect } from "vitest";
import { pickTopN } from "../src/index.js";

const CFG = { enabled: true, topN: 3, minScore: 0.3, diversity: true, lambda: 0.5 };

describe("pickTopN", () => {
  it("returns empty when no candidates pass minScore", () => {
    const r = pickTopN(
      [
        { item: "a", score: 0.1 },
        { item: "b", score: 0.2 },
      ],
      CFG,
    );
    expect(r).toEqual([]);
  });

  it("returns top N by score when diversity disabled", () => {
    const r = pickTopN(
      [
        { item: "a", score: 0.5 },
        { item: "b", score: 0.9 },
        { item: "c", score: 0.7 },
        { item: "d", score: 0.4 },
      ],
      { ...CFG, diversity: false },
    );
    expect(r.map((x) => x.item)).toEqual(["b", "c", "a"]);
  });

  it("uses MMR diversity with text similarity", () => {
    const r = pickTopN(
      [
        { item: "a", score: 0.9, text: "TypeScript programming language" },
        { item: "b", score: 0.85, text: "TypeScript programming syntax" },
        { item: "c", score: 0.7, text: "JavaScript runtime engine" },
      ],
      { ...CFG, diversity: true, lambda: 0.5 },
    );
    expect(r[0]?.item).toBe("a");
    expect(r[1]?.item).toBe("c");
  });

  it("uses cosine similarity when vectors present", () => {
    const r = pickTopN(
      [
        { item: "a", score: 0.9, vector: [1, 0, 0] },
        { item: "b", score: 0.8, vector: [1, 0, 0] },
        { item: "c", score: 0.7, vector: [0, 1, 0] },
      ],
      CFG,
    );
    expect(r[0]?.item).toBe("a");
    expect(r[1]?.item).toBe("c");
  });
});
