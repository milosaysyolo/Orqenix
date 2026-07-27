// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import {
  PermissionChecker,
  PermissionDeniedError,
  validatePermissions,
  STANDARD_PERMISSIONS,
} from "../src/permissions";

describe("Permissions", () => {
  it("validates well-formed permission strings", () => {
    const result = validatePermissions([
      "scope.read",
      "git.write",
      "fs.read:/home/milo",
      "command.execute:limited",
    ]);
    expect(result.valid).toBe(true);
  });

  it("rejects malformed permission strings", () => {
    const result = validatePermissions(["NotValid", "missing-dot"]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("exposes 19 standard permissions", () => {
    expect(Object.keys(STANDARD_PERMISSIONS).length).toBeGreaterThanOrEqual(19);
  });

  it("grants exact-match permission", () => {
    const checker = new PermissionChecker(["scope.read", "git.write"]);
    expect(checker.has("scope.read")).toBe(true);
    expect(checker.has("git.write")).toBe(true);
    expect(checker.has("git.read")).toBe(false);
  });

  it("supports scoped prefix matching for fs paths", () => {
    const checker = new PermissionChecker(["fs.read:/home/milo"]);
    expect(checker.has("fs.read:/home/milo")).toBe(true);
    expect(checker.has("fs.read:/home/milo/projects/orqenix")).toBe(true);
    expect(checker.has("fs.read:/etc")).toBe(false);
  });

  it("unscoped grant covers all scopes for resource", () => {
    const checker = new PermissionChecker(["fs.read"]);
    expect(checker.has("fs.read:/anywhere")).toBe(true);
    expect(checker.has("fs.read:/etc/passwd")).toBe(true);
  });

  it("does not allow scope escalation across resources", () => {
    const checker = new PermissionChecker(["fs.read:/home"]);
    expect(checker.has("fs.write:/home")).toBe(false);
  });

  it("assert() throws PermissionDeniedError when not granted", () => {
    const checker = new PermissionChecker(["scope.read"]);
    expect(() => checker.assert("git.write")).toThrow(PermissionDeniedError);
  });

  it("assert() returns silently when granted", () => {
    const checker = new PermissionChecker(["scope.read"]);
    expect(() => checker.assert("scope.read")).not.toThrow();
  });

  it("lists granted permissions", () => {
    const checker = new PermissionChecker(["scope.read", "git.write"]);
    expect(checker.list().sort()).toEqual(["git.write", "scope.read"]);
  });
});
