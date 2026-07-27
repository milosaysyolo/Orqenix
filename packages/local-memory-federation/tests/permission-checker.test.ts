// SPDX-License-Identifier: Apache-2.0
// Tests for PermissionChecker

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { stringify as _stringifyYaml } from "yaml";
import { PermissionChecker } from "../src/permission-checker";
import { ExpiredApprovalError, NoApprovalError } from "../src/errors";
import type { ProjectId } from "../src/types";

const PROJECT_A = "blake3:aaaaaaaa00000000" as ProjectId;
const PROJECT_B = "blake3:bbbbbbbb00000000" as ProjectId;

describe("PermissionChecker", () => {
  let tmpDir: string;
  let approvalsPath: string;
  let checker: PermissionChecker;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "orqenix-perm-test-"));
    approvalsPath = join(tmpDir, "federation-approvals.yaml");
    checker = new PermissionChecker(approvalsPath);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns NO_APPROVAL when approvals file does not exist", async () => {
    const result = await checker.check({
      sourceProjectId: PROJECT_A,
      targetProjectId: PROJECT_B,
      kind: "decision",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("NO_APPROVAL");
  });

  it("grants and verifies approval", async () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 3600 * 1000);

    await checker.grantApproval({
      source_project_id: PROJECT_A,
      target_project_id: PROJECT_B,
      scope: { chat: false, code: false, decision: true, lesson: true },
      approved_by: "milo@example.com",
      approved_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });

    const result = await checker.check({
      sourceProjectId: PROJECT_A,
      targetProjectId: PROJECT_B,
      kind: "decision",
    });
    expect(result.allowed).toBe(true);
    expect(result.approval).toBeDefined();
  });

  it("denies when KB kind not in approval scope", async () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 3600 * 1000);

    await checker.grantApproval({
      source_project_id: PROJECT_A,
      target_project_id: PROJECT_B,
      scope: { chat: false, code: false, decision: true, lesson: false },
      approved_by: "milo@example.com",
      approved_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });

    // decision allowed
    expect(
      (
        await checker.check({
          sourceProjectId: PROJECT_A,
          targetProjectId: PROJECT_B,
          kind: "decision",
        })
      ).allowed,
    ).toBe(true);

    // lesson denied (scope: false)
    expect(
      (
        await checker.check({
          sourceProjectId: PROJECT_A,
          targetProjectId: PROJECT_B,
          kind: "lesson",
        })
      ).allowed,
    ).toBe(false);

    // chat denied (scope: false)
    expect(
      (
        await checker.check({
          sourceProjectId: PROJECT_A,
          targetProjectId: PROJECT_B,
          kind: "chat",
        })
      ).allowed,
    ).toBe(false);
  });

  it("denies expired approvals and surfaces reason", async () => {
    const past = new Date(Date.now() - 24 * 3600 * 1000);
    const expiredAt = new Date(past.getTime() + 1000);

    await checker.grantApproval({
      source_project_id: PROJECT_A,
      target_project_id: PROJECT_B,
      scope: { chat: false, code: false, decision: true, lesson: true },
      approved_by: "milo@example.com",
      approved_at: past.toISOString(),
      expires_at: expiredAt.toISOString(),
    });

    const result = await checker.check({
      sourceProjectId: PROJECT_A,
      targetProjectId: PROJECT_B,
      kind: "decision",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("EXPIRED");
    expect(result.approval).toBeDefined();
  });

  it("assert() throws NoApprovalError when no approval exists", async () => {
    await expect(
      checker.assert({
        sourceProjectId: PROJECT_A,
        targetProjectId: PROJECT_B,
        kind: "decision",
      }),
    ).rejects.toBeInstanceOf(NoApprovalError);
  });

  it("assert() throws ExpiredApprovalError when approval is expired", async () => {
    const past = new Date(Date.now() - 24 * 3600 * 1000);
    const expiredAt = new Date(past.getTime() + 1000);

    await checker.grantApproval({
      source_project_id: PROJECT_A,
      target_project_id: PROJECT_B,
      scope: { chat: false, code: false, decision: true, lesson: true },
      approved_by: "milo@example.com",
      approved_at: past.toISOString(),
      expires_at: expiredAt.toISOString(),
    });

    await expect(
      checker.assert({
        sourceProjectId: PROJECT_A,
        targetProjectId: PROJECT_B,
        kind: "decision",
      }),
    ).rejects.toBeInstanceOf(ExpiredApprovalError);
  });

  it("revokeApproval removes the entry", async () => {
    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 3600 * 1000);

    await checker.grantApproval({
      source_project_id: PROJECT_A,
      target_project_id: PROJECT_B,
      scope: { chat: false, code: false, decision: true, lesson: true },
      approved_by: "milo@example.com",
      approved_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });

    await checker.revokeApproval(PROJECT_A, PROJECT_B);

    const result = await checker.check({
      sourceProjectId: PROJECT_A,
      targetProjectId: PROJECT_B,
      kind: "decision",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("NO_APPROVAL");
  });

  it("granting the same pair twice replaces (not duplicates)", async () => {
    const now = new Date();
    const expires1 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
    const expires2 = new Date(now.getTime() + 90 * 24 * 3600 * 1000);

    await checker.grantApproval({
      source_project_id: PROJECT_A,
      target_project_id: PROJECT_B,
      scope: { chat: false, code: false, decision: true, lesson: false },
      approved_by: "milo@example.com",
      approved_at: now.toISOString(),
      expires_at: expires1.toISOString(),
    });

    await checker.grantApproval({
      source_project_id: PROJECT_A,
      target_project_id: PROJECT_B,
      scope: { chat: false, code: false, decision: true, lesson: true },
      approved_by: "milo@example.com",
      approved_at: now.toISOString(),
      expires_at: expires2.toISOString(),
    });

    const list = await checker.listApprovals();
    expect(list).toHaveLength(1);
    expect(list[0]?.expires_at).toBe(expires2.toISOString());
    expect(list[0]?.scope.lesson).toBe(true);
  });
});
