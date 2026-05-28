import { describe, it, expect } from "vitest";
import {
  createGraph,
  addDecision,
  ancestors,
  descendants,
  pathBetween,
  listByTag,
  removeDecision,
  deriveId,
} from "../src/index.js";

describe("kb-decisions edge cases", () => {
  it("deriveId differs when content differs", () => {
    const a = deriveId({ title: "x", rationale: "y", decidedAt: 1 });
    const b = deriveId({ title: "x", rationale: "z", decidedAt: 1 });
    expect(a).not.toBe(b);
  });

  it("ancestors returns single node for root", () => {
    const g = createGraph();
    addDecision(g, {
      id: "root",
      title: "",
      decidedAt: 0,
      rationale: "",
      parents: [],
    });
    expect(ancestors(g, "root").map((n) => n.id)).toEqual(["root"]);
  });

  it("descendants of missing id is empty", () => {
    const g = createGraph();
    expect(descendants(g, "missing")).toEqual([]);
  });

  it("pathBetween from node to itself is [self]", () => {
    const g = createGraph();
    addDecision(g, {
      id: "a",
      title: "",
      decidedAt: 0,
      rationale: "",
      parents: [],
    });
    const path = pathBetween(g, "a", "a");
    expect(path?.map((n) => n.id)).toEqual(["a"]);
  });

  it("listByTag returns multiple matches", () => {
    const g = createGraph();
    addDecision(g, {
      id: "1",
      title: "",
      decidedAt: 0,
      rationale: "",
      parents: [],
      tags: ["arch"],
    });
    addDecision(g, {
      id: "2",
      title: "",
      decidedAt: 0,
      rationale: "",
      parents: [],
      tags: ["arch", "ops"],
    });
    expect(listByTag(g, "arch")).toHaveLength(2);
  });

  it("removeDecision returns false for missing id", () => {
    const g = createGraph();
    expect(removeDecision(g, "missing")).toBe(false);
  });
});
