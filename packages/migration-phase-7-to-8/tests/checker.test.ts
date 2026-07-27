// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MigrationChecker } from "../src/checker";

describe("MigrationChecker", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "orqenix-mig-check-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("detects unknown when no config", async () => {
    const result = await new MigrationChecker().check(tmpDir);
    expect(result.detectedPhase).toBe("unknown");
    expect(result.ready).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("detects Phase 7 with scope.yaml", async () => {
    await mkdir(join(tmpDir, ".orqenix"), { recursive: true });
    await writeFile(join(tmpDir, ".orqenix", "scope.yaml"), "scope_id: blake3:abc\nname: test\n");
    const result = await new MigrationChecker().check(tmpDir);
    expect(result.detectedPhase).toBe(7);
    expect(result.ready).toBe(true);
  });

  it("detects Phase 8 (already migrated) with project.yaml", async () => {
    await mkdir(join(tmpDir, ".orqenix"), { recursive: true });
    await writeFile(join(tmpDir, ".orqenix", "project.yaml"), "project_id: blake3:abc\n");
    const result = await new MigrationChecker().check(tmpDir);
    expect(result.detectedPhase).toBe(8);
    expect(result.ready).toBe(false); // already migrated
  });
});
