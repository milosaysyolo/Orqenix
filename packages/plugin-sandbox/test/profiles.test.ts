import { describe, it, expect } from "vitest";
import { getProfile, isPathAllowed } from "../src/index.js";

describe("sandbox profiles", () => {
  it("strict denies write and network", () => {
    const p = getProfile("strict");
    expect(p.allowFsWrite).toBe(false);
    expect(p.allowNetwork).toBe(false);
  });

  it("lenient allows everything", () => {
    const p = getProfile("lenient");
    expect(p.allowFsWrite).toBe(true);
    expect(p.allowNetwork).toBe(true);
  });

  it("audit-only enables auditMode", () => {
    const p = getProfile("audit-only");
    expect(p.auditMode).toBe(true);
  });

  it("isPathAllowed respects blocklist", () => {
    const p = getProfile("lenient");
    p.blockedFsPaths = ["/etc"];
    expect(isPathAllowed(p, "/etc/passwd")).toBe(false);
    expect(isPathAllowed(p, "/home/user")).toBe(true);
  });

  it("isPathAllowed respects allowlist", () => {
    const p = getProfile("lenient");
    p.allowedFsPaths = ["/workspace"];
    expect(isPathAllowed(p, "/workspace/file")).toBe(true);
    expect(isPathAllowed(p, "/elsewhere/file")).toBe(false);
  });
});
