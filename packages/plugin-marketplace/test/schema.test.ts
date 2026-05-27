import { describe, it, expect } from "vitest";
import { validateManifest } from "../src/index.js";

describe("validateManifest", () => {
  it("accepts minimal valid manifest", () => {
    expect(
      validateManifest({
        name: "m",
        owner: { name: "o" },
        plugins: [{ name: "x", description: "d", source: "./x" }],
      }).ok
    ).toBe(true);
  });

  it("rejects missing name", () => {
    const r = validateManifest({ owner: { name: "o" }, plugins: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid sha for external", () => {
    const r = validateManifest({
      name: "m",
      owner: { name: "o" },
      plugins: [
        {
          name: "x",
          description: "d",
          source: { source: "url", url: "https://x", sha: "short" },
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.find((e) => e.kind === "invalid-sha")).toBeDefined();
  });

  it("rejects duplicate plugin names", () => {
    const r = validateManifest({
      name: "m",
      owner: { name: "o" },
      plugins: [
        { name: "x", description: "d", source: "./a" },
        { name: "x", description: "d", source: "./b" },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.find((e) => e.kind === "duplicate-name")).toBeDefined();
  });

  it("accepts git-subdir form with valid sha", () => {
    const r = validateManifest({
      name: "m",
      owner: { name: "o" },
      plugins: [
        {
          name: "x",
          description: "d",
          source: {
            source: "git-subdir",
            url: "https://x",
            path: "plugins/x",
            ref: "main",
            sha: "0123456789abcdef0123456789abcdef01234567",
          },
        },
      ],
    });
    expect(r.ok).toBe(true);
  });
});
