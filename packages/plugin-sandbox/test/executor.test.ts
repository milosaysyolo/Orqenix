import { describe, it, expect } from "vitest";
import { getProfile, checkOperation } from "../src/index.js";

describe("sandbox executor", () => {
  it("strict denies fs.write", () => {
    const r = checkOperation(getProfile("strict"), {
      kind: "fs.write",
      path: "/tmp/x",
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/fs.write disabled/);
  });

  it("lenient allows fs.write", () => {
    const r = checkOperation(getProfile("lenient"), {
      kind: "fs.write",
      path: "/tmp/x",
    });
    expect(r.allowed).toBe(true);
  });

  it("audit-only allows but records", () => {
    const r = checkOperation(getProfile("audit-only"), {
      kind: "subprocess",
      command: "ls",
    });
    expect(r.allowed).toBe(true);
    expect(r.audit.operation.kind).toBe("subprocess");
  });

  it("strict denies network", () => {
    const r = checkOperation(getProfile("strict"), {
      kind: "network",
      url: "https://x",
    });
    expect(r.allowed).toBe(false);
  });

  it("strict denies write to blocked path", () => {
    const p = getProfile("lenient");
    p.blockedFsPaths = ["/etc"];
    const r = checkOperation(p, { kind: "fs.write", path: "/etc/shadow" });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/path not allowed/);
  });
});
