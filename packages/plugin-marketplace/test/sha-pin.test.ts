import { describe, it, expect } from "vitest";
import { isValidSha, proposeBumps } from "../src/index.js";

describe("sha-pin", () => {
  it("isValidSha accepts 40-char hex", () => {
    expect(isValidSha("0123456789abcdef0123456789abcdef01234567")).toBe(true);
    expect(isValidSha("0123")).toBe(false);
    expect(isValidSha("zzz" + "0".repeat(37))).toBe(false);
  });

  it("proposeBumps proposes when sha differs", () => {
    const upstream = new Map([["main", "1111111111111111111111111111111111111111"]]);
    const proposals = proposeBumps(
      [{ name: "x", sha: "0000000000000000000000000000000000000000", ref: "main" }],
      upstream
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.newSha).toBe("1111111111111111111111111111111111111111");
  });

  it("proposeBumps skips when sha matches", () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    const upstream = new Map([["main", sha]]);
    expect(
      proposeBumps([{ name: "x", sha, ref: "main" }], upstream)
    ).toEqual([]);
  });

  it("proposeBumps skips ref missing from upstream", () => {
    expect(
      proposeBumps(
        [{ name: "x", sha: "0".repeat(40), ref: "develop" }],
        new Map([["main", "1".repeat(40)]])
      )
    ).toEqual([]);
  });
});
