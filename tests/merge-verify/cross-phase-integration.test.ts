// SPDX-License-Identifier: Apache-2.0
// CROSS-PHASE SEAMS: the integration points where one phase consumes another.
// These are what a far-diverged merge most likely breaks. Typecheck won't
// catch a runtime contract drift — these tests will.

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoryEngine } from "@orqenix/memory-engine";
import { FederationEngine } from "@orqenix/local-memory-federation";
import { SettingsRegistry, InMemorySettingsPersistence } from "@orqenix/settings-registry";
import { Observer } from "@orqenix/self-learning-observer";
import { BasicDetector } from "@orqenix/self-learning-detection";
import { stringify as stringifyYaml } from "yaml";
import { ulid } from "@orqenix/memory-engine";

const PROJECT = "blake3:aabbccdd00112233cccc";
const MAIN = "blake3:main";

describe("CROSS-PHASE SEAMS", () => {
  let engine: MemoryEngine | undefined;
  afterEach(async () => {
    try {
      engine?.close();
    } catch {}
    engine = undefined;
  });

  it("SEAM Phase8→Phase3+7: write goes through storage AND audits", async () => {
    engine = await MemoryEngine.open(":memory:", { projectId: PROJECT, bootstrapBaseTables: true });
    const entry = await engine.write({
      kb: "decision",
      content: "seam test",
      branch_id: MAIN,
      memory_level: "branch",
    });
    expect(engine.fetchContent("decision", entry.id)).toBe("seam test");
    const audit = engine.listAudit(0, 10);
    expect(audit.some((e) => e.kind === "memory.write")).toBe(true);
    expect(engine.verifyAuditChain().valid).toBe(true);
  });

  it("SEAM Federation→Engine: federation query routes to engine store", async () => {
    let tmpDir = await mkdtemp(join(tmpdir(), "seam-"));
    try {
      const projectsYaml = join(tmpDir, "projects.yaml");
      const approvalsYaml = join(tmpDir, "approvals.yaml");
      await writeFile(
        projectsYaml,
        stringifyYaml({
          projects: [
            {
              id: PROJECT,
              name: "self",
              path: tmpDir,
              registered_at: new Date().toISOString(),
              cross_project_sharing_enabled: true,
            },
          ],
        }),
      );
      const fed = new FederationEngine({
        currentProjectId: PROJECT as never,
        userId: "milo",
        projectsYamlPath: projectsYaml,
        approvalsYamlPath: approvalsYaml,
      });
      const result = await fed.crossProjectQuery({ query: "test", limit: 10 });
      expect(result.candidates).toEqual([]);
      expect(result.cache_hit).toBe(false);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("SEAM Settings→Engine: settings resolve through hierarchy", async () => {
    const registry = new SettingsRegistry({ persistence: new InMemorySettingsPersistence() });
    await registry.register({
      moduleId: "@orqenix/memory-engine",
      version: "0.8.0",
      settingsSchema: {},
      defaults: { "hierarchy.level_boost.session": 1.5 },
      provenance: { phase: 8, crVersion: "v8.0", rationale: "seam" },
      hotReloadable: true,
      hierarchyOverride: "all",
    });
    const resolved = await registry.resolve(
      "@orqenix/memory-engine",
      "hierarchy.level_boost.session",
      {},
    );
    expect(resolved.value).toBe(1.5);
    expect(resolved.provenance.phase).toBe(8);
  });

  it("SEAM Observer→Detection→DB: pattern detection over observations", async () => {
    const obsEngine = await MemoryEngine.open(":memory:", {
      projectId: PROJECT,
      bootstrapBaseTables: true,
    });
    const db = obsEngine.getStore().db;
    const { SELF_LEARNING_MIGRATIONS } = await import("@orqenix/self-learning-observer");
    for (const m of SELF_LEARNING_MIGRATIONS) db.exec(m.up);

    const insertStmt = db.prepare(`INSERT INTO observation_events (
      id, project_id, branch_id, session_id, parent_session_id, timestamp,
      agent_platform, actor_kind, actor_id, action_kind, action_payload_json,
      outcome_kind, outcome_duration_ms, outcome_payload_json,
      pii_redaction_applied, redaction_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const baseTime = new Date();
    for (let i = 0; i < 6; i++) {
      const t1 = new Date(baseTime.getTime() + i * 200);
      const t2 = new Date(baseTime.getTime() + i * 200 + 100);
      insertStmt.run(
        ulid(),
        PROJECT,
        null,
        `s${i}`,
        null,
        t1.toISOString(),
        null,
        "agent",
        "x",
        "file_edit",
        JSON.stringify({ f: i }),
        null,
        null,
        null,
        0,
        null,
      );
      insertStmt.run(
        ulid(),
        PROJECT,
        null,
        `s${i}`,
        null,
        t2.toISOString(),
        null,
        "agent",
        "x",
        "test_run",
        JSON.stringify({}),
        "success",
        5000,
        null,
        0,
        null,
      );
    }

    const observer = new Observer({ db });
    const events = observer.query({ projectId: PROJECT, limit: 1000 });

    const detector = new BasicDetector({ db });
    const result = await detector.run({ projectId: PROJECT, events });

    obsEngine.close();
    expect(result.candidatesCreated).toBeGreaterThanOrEqual(1);
  });
});
