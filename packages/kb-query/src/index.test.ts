import { describe, it, expect } from "vitest";
import { KnowledgeQueryEngine } from "./index";

describe("kb-query", () => {
  it("exports KnowledgeQueryEngine class", () => {
    expect(typeof KnowledgeQueryEngine).toBe("function");
  });

  it("KnowledgeQueryEngine prototype exposes query", () => {
    expect(typeof KnowledgeQueryEngine.prototype.query).toBe("function");
  });
});
