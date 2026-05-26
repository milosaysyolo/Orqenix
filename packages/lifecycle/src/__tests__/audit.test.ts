import { describe, it, expect } from "vitest";
import { appendAudit } from "../audit/writer";
import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, readFileSync } from "node:fs";

describe("audit", () => {
  it("should append audit entry with signature", async () => {
    const root = join(tmpdir(), "audit-test-1");
    rmSync(root, { recursive: true, force: true });
    const auditPath = join(root, "audit.log");

    const { privateKey } = generateKeyPairSync("ed25519");
    await appendAudit(
      auditPath,
      {
        timestamp: new Date().toISOString(),
        actor: "test-user",
        action: "skill:install",
        artifact: "skill-1@1.0.0",
      },
      privateKey,
    );

    const content = readFileSync(auditPath, "utf8");
    expect(content).toContain("actor: test-user");
    expect(content).toContain("signature: ed25519:");
  });

  it("should append multiple entries", async () => {
    const root = join(tmpdir(), "audit-test-2");
    rmSync(root, { recursive: true, force: true });
    const auditPath = join(root, "audit.log");

    const { privateKey } = generateKeyPairSync("ed25519");
    await appendAudit(
      auditPath,
      {
        timestamp: new Date().toISOString(),
        actor: "user1",
        action: "skill:install",
      },
      privateKey,
    );
    await appendAudit(
      auditPath,
      {
        timestamp: new Date().toISOString(),
        actor: "user2",
        action: "skill:uninstall",
      },
      privateKey,
    );

    const content = readFileSync(auditPath, "utf8");
    expect(content).toContain("user1");
    expect(content).toContain("user2");
  });

  it("should include details in audit entry", async () => {
    const root = join(tmpdir(), "audit-test-3");
    rmSync(root, { recursive: true, force: true });
    const auditPath = join(root, "audit.log");

    const { privateKey } = generateKeyPairSync("ed25519");
    await appendAudit(
      auditPath,
      {
        timestamp: new Date().toISOString(),
        actor: "admin",
        action: "config:update",
        details: { key: "embedding.primary", value: "cloud" },
      },
      privateKey,
    );

    const content = readFileSync(auditPath, "utf8");
    expect(content).toContain("details:");
  });
});
