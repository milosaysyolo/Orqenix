import { describe, it, expect } from "vitest";
import { loadRetentionPolicy } from "../retention/loader";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("retention policy", () => {
  it("should parse retention policy YAML", () => {
    const yaml = `
defaults:
  stale_grace_period: 7d
  trash_retention: 30d
  snapshot_keep_last_n: 10
  snapshot_keep_min_age: 24h
  workspace_generation_keep: 50

per_artifact_type:
  skill:
    stale_grace_period: 14d

pins: []

quotas:
  max_disk_per_project: 5GB
  max_disk_global: 50GB
`;
    const tmp = join(tmpdir(), "retention.yaml");
    writeFileSync(tmp, yaml);
    const policy = loadRetentionPolicy(tmp);
    expect(policy.defaults.staleGracePeriodMs).toBe(7 * 86_400_000);
    expect(policy.quotas.maxDiskPerProjectBytes).toBe(5 * 1024 ** 3);
  });

  it("should parse duration units", () => {
    const yaml = `
defaults:
  stale_grace_period: 1d
  trash_retention: 1h
  snapshot_keep_last_n: 5
  snapshot_keep_min_age: 1m
  workspace_generation_keep: 10

per_artifact_type: {}
pins: []

quotas:
  max_disk_per_project: 1GB
  max_disk_global: 10GB
`;
    const tmp = join(tmpdir(), "retention2.yaml");
    writeFileSync(tmp, yaml);
    const policy = loadRetentionPolicy(tmp);
    expect(policy.defaults.staleGracePeriodMs).toBe(86_400_000);
    expect(policy.defaults.trashRetentionMs).toBe(3_600_000);
  });

  it("should handle per-artifact overrides", () => {
    const yaml = `
defaults:
  stale_grace_period: 7d
  trash_retention: 30d
  snapshot_keep_last_n: 10
  snapshot_keep_min_age: 24h
  workspace_generation_keep: 50

per_artifact_type:
  skill:
    stale_grace_period: 14d

pins: []

quotas:
  max_disk_per_project: 5GB
  max_disk_global: 50GB
`;
    const tmp = join(tmpdir(), "retention3.yaml");
    writeFileSync(tmp, yaml);
    const policy = loadRetentionPolicy(tmp);
    expect(policy.perArtifactType.skill).toBeDefined();
  });

  it("should parse quota sizes", () => {
    const yaml = `
defaults:
  stale_grace_period: 7d
  trash_retention: 30d
  snapshot_keep_last_n: 10
  snapshot_keep_min_age: 24h
  workspace_generation_keep: 50

per_artifact_type: {}
pins: []

quotas:
  max_disk_per_project: 100MB
  max_disk_global: 1TB
`;
    const tmp = join(tmpdir(), "retention4.yaml");
    writeFileSync(tmp, yaml);
    const policy = loadRetentionPolicy(tmp);
    expect(policy.quotas.maxDiskPerProjectBytes).toBe(100 * 1024 ** 2);
    expect(policy.quotas.maxDiskGlobalBytes).toBe(1024 ** 4);
  });
});
