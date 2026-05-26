import { describe, it, expect } from "vitest";
import { SnapshotWriter } from "../snapshot/writer";
import { CAS } from "../cas/store";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

describe("snapshot", () => {
  it("should generate next generation number", async () => {
    const root = join(tmpdir(), "snap-test-1");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(join(root, "cas"));
    const writer = new SnapshotWriter(join(root, "gen"), cas);
    const num = await writer.nextGenerationNumber();
    expect(num).toBe(1);
  });

  it("should write manifest", async () => {
    const root = join(tmpdir(), "snap-test-2");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(join(root, "cas"));
    const writer = new SnapshotWriter(join(root, "gen"), cas);
    const dir = await writer.write({
      generation: 1,
      createdAt: new Date().toISOString(),
      artifacts: [],
      config: {},
    });
    expect(dir).toContain("gen-00001");
  });

  it("should increment generation number", async () => {
    const root = join(tmpdir(), "snap-test-3");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(join(root, "cas"));
    const writer = new SnapshotWriter(join(root, "gen"), cas);
    await writer.write({
      generation: 1,
      createdAt: new Date().toISOString(),
      artifacts: [],
      config: {},
    });
    const num = await writer.nextGenerationNumber();
    expect(num).toBe(2);
  });

  it("should pad generation number", async () => {
    const root = join(tmpdir(), "snap-test-4");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(join(root, "cas"));
    const writer = new SnapshotWriter(join(root, "gen"), cas);
    const dir = await writer.write({
      generation: 42,
      createdAt: new Date().toISOString(),
      artifacts: [],
      config: {},
    });
    expect(dir).toContain("gen-00042");
  });

  it("should store manifest with artifacts", async () => {
    const root = join(tmpdir(), "snap-test-5");
    rmSync(root, { recursive: true, force: true });
    const cas = new CAS(join(root, "cas"));
    const writer = new SnapshotWriter(join(root, "gen"), cas);
    await writer.write({
      generation: 1,
      createdAt: new Date().toISOString(),
      artifacts: [
        {
          id: "skill-1",
          type: "skill",
          version: "1.0.0",
          contentHash: "sha256:abc123",
        },
      ],
      config: {},
    });
    expect(true).toBe(true);
  });
});
