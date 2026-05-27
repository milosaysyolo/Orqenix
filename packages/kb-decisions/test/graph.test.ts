import { describe, it, expect } from "vitest";
import {
  createGraph,
  deriveId,
  addDecision,
  getDecision,
  removeDecision,
  listByTag,
} from "../src/index.js";

describe("kb-decisions graph", () => {
  it("creates empty graph", () => {
    const g = createGraph();
    expect(g.nodes.size).toBe(0);
  });

  it("derives deterministic id from content", () => {
    const a = deriveId({ title: "x", rationale: "y", decidedAt: 1 });
    const b = deriveId({ title: "x", rationale: "y", decidedAt: 1 });
    expect(a).toBe(b);
  });

  it("addDecision stores node", () => {
    const g = createGraph();
    addDecision(g, {
      id: "1",
      title: "root",
      decidedAt: 0,
      rationale: "",
      parents: [],
    });
    expect(getDecision(g, "1")?.title).toBe("root");
  });

  it("addDecision rejects duplicate id", () => {
    const g = createGraph();
    const n = { id: "1", title: "a", decidedAt: 0, rationale: "", parents: [] };
    addDecision(g, n);
    expect(() => addDecision(g, n)).toThrow(/already exists/);
  });

  it("addDecision rejects missing parent", () => {
    const g = createGraph();
    expect(() =>
      addDecision(g, {
        id: "1",
        title: "a",
        decidedAt: 0,
        rationale: "",
        parents: ["missing"],
      })
    ).toThrow(/Parent missing not in graph/);
  });

  it("removeDecision deletes leaf node", () => {
    const g = createGraph();
    addDecision(g, { id: "1", title: "a", decidedAt: 0, rationale: "", parents: [] });
    expect(removeDecision(g, "1")).toBe(true);
    expect(g.nodes.size).toBe(0);
  });

  it("removeDecision refuses if has children", () => {
    const g = createGraph();
    addDecision(g, { id: "1", title: "a", decidedAt: 0, rationale: "", parents: [] });
    addDecision(g, { id: "2", title: "b", decidedAt: 0, rationale: "", parents: ["1"] });
    expect(() => removeDecision(g, "1")).toThrow(/has children/);
  });

  it("listByTag filters by tag", () => {
    const g = createGraph();
    addDecision(g, { id: "1", title: "a", decidedAt: 0, rationale: "", parents: [], tags: ["arch"] });
    addDecision(g, { id: "2", title: "b", decidedAt: 0, rationale: "", parents: [], tags: ["ops"] });
    expect(listByTag(g, "arch").map((n) => n.id)).toEqual(["1"]);
  });
});
