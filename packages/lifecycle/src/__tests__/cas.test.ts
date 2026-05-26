import { describe, it, expect } from "vitest";
import { CAS } from "../cas/store";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

describe("CAS", () => {
  it("should put and get content", async () => {
    const root = join(tmpdir(), "cas-test-1");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(root);
    const hash = await cas.put(Buffer.from("hello"));
    const content = await cas.get(hash);
    expect(content.toString()).toBe("hello");
  });

  it("should deduplicate identical content", async () => {
    const root = join(tmpdir(), "cas-test-2");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(root);
    const hash1 = await cas.put(Buffer.from("same"));
    const hash2 = await cas.put(Buffer.from("same"));
    expect(hash1).toBe(hash2);
  });

  it("should handle different content", async () => {
    const root = join(tmpdir(), "cas-test-3");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(root);
    const hash1 = await cas.put(Buffer.from("a"));
    const hash2 = await cas.put(Buffer.from("b"));
    expect(hash1).not.toBe(hash2);
  });

  it("should reject missing hash on get", async () => {
    const root = join(tmpdir(), "cas-test-4");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(root);
    await expect(cas.get("missinghash")).rejects.toThrow();
  });
});
