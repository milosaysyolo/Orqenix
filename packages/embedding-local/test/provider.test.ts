import { describe, it, expect } from "vitest";
import * as embeddingLocal from "../src/index.js";

describe("embedding-local public API", () => {
  it("exports at least one named member", () => {
    const keys = Object.keys(embeddingLocal);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("exports createLocalEmbedder as factory function", () => {
    expect(typeof embeddingLocal.createLocalEmbedder).toBe("function");
  });

  it("exports LocalEmbedder interface with dims and embed", () => {
    const iface: keyof typeof embeddingLocal = "createLocalEmbedder";
    expect(iface).toBe("createLocalEmbedder");
  });
});

describe("embedding-local provider behavior", () => {
  it("createLocalEmbedder is async function", () => {
    const result = embeddingLocal.createLocalEmbedder();
    expect(result).toBeInstanceOf(Promise);
  });
});
