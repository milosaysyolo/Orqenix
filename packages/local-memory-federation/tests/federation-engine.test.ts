// SPDX-License-Identifier: Apache-2.0
// E2E tests for FederationEngine

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify as stringifyYaml } from "yaml";
import { FederationEngine } from "../src/federation-engine";
import { InMemoryAuditChainWriter } from "../src/audit-logger";
import type { ProjectId } from "../src/types";

const PROJECT_CURRENT = "blake3:cccccccc00000000" as ProjectId;
const PROJECT_OTHER = "blake3:dddddddd00000000" as ProjectId;

describe("FederationEngine (E2E)", () => {
  let tmpDir: string;
  let projectsYamlPath: string;
  let approvalsYamlPath: string;
  let auditWriter: InMemoryAuditChainWriter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "orqenix-fed-e2e-"));
    projectsYamlPath = join(tmpDir, "projects.yaml");
    approvalsYamlPath = join(tmpDir, "federation-approvals.yaml");
    auditWriter = new InMemoryAuditChainWriter();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty result when no other projects opted in", async () => {
    // Registry has current project but no others
    await writeFile(
      projectsYamlPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_CURRENT,
            name: "self",
            path: "/self",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const engine = new FederationEngine(
      {
        currentProjectId: PROJECT_CURRENT,
        userId: "milo@example.com",
        projectsYamlPath,
        approvalsYamlPath,
      },
      { auditWriter },
    );

    const result = await engine.crossProjectQuery({
      query: "auth",
      limit: 10,
    });

    expect(result.candidates).toEqual([]);
    expect(result.projects_queried).toEqual([]);
    expect(result.cache_hit).toBe(false);
  });

  it("returns empty when other project exists but no approval", async () => {
    await writeFile(
      projectsYamlPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_CURRENT,
            name: "self",
            path: "/self",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
          {
            id: PROJECT_OTHER,
            name: "other",
            path: "/other",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const engine = new FederationEngine(
      {
        currentProjectId: PROJECT_CURRENT,
        userId: "milo@example.com",
        projectsYamlPath,
        approvalsYamlPath,
      },
      { auditWriter },
    );

    const result = await engine.crossProjectQuery({
      query: "auth",
      limit: 10,
    });

    // Per INV-18: candidate retrieval blocked without approval
    expect(result.candidates).toEqual([]);
  });

  it("queries other project when approval exists", async () => {
    await writeFile(
      projectsYamlPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_CURRENT,
            name: "self",
            path: "/self",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
          {
            id: PROJECT_OTHER,
            name: "other",
            path: "/other",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const now = new Date();
    const expires = new Date(now.getTime() + 90 * 24 * 3600 * 1000);

    await writeFile(
      approvalsYamlPath,
      stringifyYaml({
        approvals: [
          {
            source_project_id: PROJECT_OTHER,
            target_project_id: PROJECT_CURRENT,
            scope: {
              chat: false,
              code: false,
              decision: true,
              lesson: true,
            },
            approved_by: "milo@example.com",
            approved_at: now.toISOString(),
            expires_at: expires.toISOString(),
          },
        ],
      }),
    );

    const engine = new FederationEngine(
      {
        currentProjectId: PROJECT_CURRENT,
        userId: "milo@example.com",
        projectsYamlPath,
        approvalsYamlPath,
      },
      { auditWriter },
    );

    const result = await engine.crossProjectQuery({
      query: "auth",
      limit: 10,
    });

    // PROJECT_OTHER appears in projects_queried because approval granted
    expect(result.projects_queried).toContain(PROJECT_OTHER);
    // Empty candidates because ProjectIndex stub returns no data in D8.α.3
    expect(result.candidates).toEqual([]);

    // Audit event recorded
    const events = auditWriter.getEvents();
    const queryEvent = events.find((e) => e.kind === "memory.cross_project_query");
    expect(queryEvent).toBeDefined();
    expect(queryEvent?.projectId).toBe(PROJECT_CURRENT);
  });

  it("caches results across calls", async () => {
    await writeFile(
      projectsYamlPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_CURRENT,
            name: "self",
            path: "/self",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const engine = new FederationEngine(
      {
        currentProjectId: PROJECT_CURRENT,
        userId: "milo@example.com",
        projectsYamlPath,
        approvalsYamlPath,
      },
      { auditWriter },
    );

    const r1 = await engine.crossProjectQuery({
      query: "auth",
      limit: 10,
    });
    const r2 = await engine.crossProjectQuery({
      query: "auth",
      limit: 10,
    });

    expect(r1.cache_hit).toBe(false);
    expect(r2.cache_hit).toBe(true);
  });

  it("skipCache forces fresh fetch", async () => {
    await writeFile(
      projectsYamlPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_CURRENT,
            name: "self",
            path: "/self",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const engine = new FederationEngine(
      {
        currentProjectId: PROJECT_CURRENT,
        userId: "milo@example.com",
        projectsYamlPath,
        approvalsYamlPath,
      },
      { auditWriter },
    );

    await engine.crossProjectQuery({ query: "auth", limit: 10 });
    const r2 = await engine.crossProjectQuery({
      query: "auth",
      limit: 10,
      skipCache: true,
    });

    expect(r2.cache_hit).toBe(false);
  });

  it("validates query input via Zod", async () => {
    const engine = new FederationEngine(
      {
        currentProjectId: PROJECT_CURRENT,
        userId: "milo@example.com",
        projectsYamlPath,
        approvalsYamlPath,
      },
      { auditWriter },
    );

    await expect(engine.crossProjectQuery({ query: "", limit: 10 })).rejects.toThrow();

    await expect(engine.crossProjectQuery({ query: "ok", limit: -1 })).rejects.toThrow();

    await expect(engine.crossProjectQuery({ query: "ok", limit: 500 })).rejects.toThrow();
  });

  it("clearCache resets state", async () => {
    await writeFile(
      projectsYamlPath,
      stringifyYaml({
        projects: [
          {
            id: PROJECT_CURRENT,
            name: "self",
            path: "/self",
            registered_at: "2026-06-11T00:00:00Z",
            cross_project_sharing_enabled: true,
          },
        ],
      }),
    );

    const engine = new FederationEngine(
      {
        currentProjectId: PROJECT_CURRENT,
        userId: "milo@example.com",
        projectsYamlPath,
        approvalsYamlPath,
      },
      { auditWriter },
    );

    await engine.crossProjectQuery({ query: "auth", limit: 10 });
    expect(engine.getCacheSize()).toBe(1);

    engine.clearCache();
    expect(engine.getCacheSize()).toBe(0);

    const r2 = await engine.crossProjectQuery({ query: "auth", limit: 10 });
    expect(r2.cache_hit).toBe(false);
  });
});
