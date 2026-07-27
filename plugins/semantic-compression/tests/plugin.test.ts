// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { invoke } from "../src/index";

describe("semantic-compression reference plugin", () => {
  it("passes through short entries unchanged", async () => {
    const result = await invoke({ entries: [{ id: "1", content: "short entry" }] });
    expect(result.compressed[0]!.compressed).toBe(false);
    expect(result.compressed[0]!.content).toBe("short entry");
  });

  it("compresses long entries", async () => {
    const long = "A. " + "x".repeat(300);
    const result = await invoke({ entries: [{ id: "1", content: long }] });
    expect(result.compressed[0]!.compressed).toBe(true);
    expect(result.compressed[0]!.content).toContain("[compressed from");
  });

  it("honors never_compress flag (INV-13)", async () => {
    const long = "B. " + "y".repeat(300);
    const result = await invoke({
      entries: [{ id: "1", content: long, protection_flags: { never_compress: true } }],
    });
    expect(result.compressed[0]!.compressed).toBe(false);
    expect(result.compressed[0]!.content).toBe(long);
  });
});
