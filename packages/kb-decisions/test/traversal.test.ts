import { describe, it, expect } from "vitest";
import {
  createGraph,
  addDecision,
  ancestors,
  descendants,
  pathBetween,
} from "../src/index.js";

function setup() {
  const g = createGraph();
  addDecision(g, { id: "root", title: "", decidedAt: 0, rationale: "", parents: [] });
  addDecision(g, { id: "a", title: "", decidedAt: 0, rationale: "", parents: ["root"] });
  addDecision(g, { id: "b", title: "", decidedAt: 0, rationale: "", parents: ["root"] });
  addDecision(g, { id: "c", title: "", decidedAt: 0, rationale: "", parents: ["a", "b"] });
  addDecision(g, { id: "d", title: "", decidedAt: 0, rationale: "", parents: ["c"] });
  return g;
}

describe("kb-decisions traversal", () => {
  it("ancestors returns chain to root", () => {
    const g = setup();
    const ids = ancestors(g, "d").map((n) => n.id);
    expect(ids).toContain("d");
    expect(ids).toContain("root");
  });

  it("ancestors respects maxDepth", () => {
    const g = setup();
    const ids = ancestors(g, "d", { maxDepth: 1 }).map((n) => n.id);
    expect(ids).toEqual(["d", "c"]);
  });

  it("descendants returns subtree", () => {
    const g = setup();
    const ids = descendants(g, "root").map((n) => n.id);
    expect(ids).toContain("a");
    expect(ids).toContain("d");
  });

  it("descendants of leaf is just leaf", () => {
    const g = setup();
    const ids = descendants(g, "d").map((n) => n.id);
    expect(ids).toEqual(["d"]);
  });

  it("pathBetween finds direct path", () => {
    const g = setup();
    const path = pathBetween(g, "d", "root");
    expect(path?.map((n) => n.id)).toEqual(["d", "c", "a", "root"]);
  });

  it("pathBetween returns null when no path", () => {
    const g = createGraph();
    addDecision(g, { id: "x", title: "", decidedAt: 0, rationale: "", parents: [] });
    addDecision(g, { id: "y", title: "", decidedAt: 0, rationale: "", parents: [] });
    expect(pathBetween(g, "x", "y")).toBeNull();
  });

  it("ancestors of missing id returns empty", () => {
    const g = setup();
    expect(ancestors(g, "missing")).toEqual([]);
  });
});
