import { describe, it, expect } from "vitest";
import { getProfile, checkOperation, isPathAllowed } from "../src/index.js";

describe("plugin-sandbox integration", () => {
  it("getProfile returns independent copy", () => {
    const p1 = getProfile("strict");
    const p2 = getProfile("strict");
    p1.allowFsWrite = true;
    expect(p2.allowFsWrite).toBe(false);
  });

  it("audit-only records denied-equivalent operations as allowed", () => {
    const p = getProfile("audit-only");
    p.allowFsWrite = false;
    const r = checkOperation(p, { kind: "fs.write", path: "/tmp/x" });
    expect(r.allowed).toBe(true);
    expect(r.audit.operation.kind).toBe("fs.write");
  });

  it("isPathAllowed with empty allowlist allows all unblocked", () => {
    const p = getProfile("lenient");
    expect(isPathAllowed(p, "/anywhere")).toBe(true);
  });

  it("checkOperation timestamps audit entry", () => {
    const p = getProfile("strict");
    const now = 1234567890;
    const r = checkOperation(p, { kind: "fs.read", path: "/x" }, now);
    expect(r.audit.timestamp).toBe(now);
  });
});
