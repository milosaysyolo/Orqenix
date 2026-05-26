import { parse as parseYaml } from "yaml";
import { readFileSync } from "node:fs";

export interface RetentionPolicy {
  defaults: {
    staleGracePeriodMs: number;
    trashRetentionMs: number;
    snapshotKeepLastN: number;
    snapshotKeepMinAgeMs: number;
    workspaceGenerationKeep: number;
  };
  perArtifactType: Record<string, Partial<RetentionPolicy["defaults"]>>;
  pins: string[];
  quotas: { maxDiskPerProjectBytes: number; maxDiskGlobalBytes: number };
}

const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

function parseDuration(s: string): number {
  const m = s.match(/^(\d+)([smhd])$/);
  if (!m) {
    throw new Error(`Bad duration: ${s}`);
  }
  return Number(m[1]!) * UNIT_MS[m[2]!]!;
}

function parseBytes(s: string): number {
  const m = s.match(/^(\d+)(KB|MB|GB|TB)$/i);
  if (!m) {
    throw new Error(`Bad size: ${s}`);
  }
  const mult: Record<string, number> = {
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return Number(m[1]!) * mult[m[2]!.toUpperCase()]!;
}

export function loadRetentionPolicy(path: string): RetentionPolicy {
  const raw = parseYaml(readFileSync(path, "utf8")) as any;
  const defaults = raw.defaults as any;
  const quotas = raw.quotas as any;
  return {
    defaults: {
      staleGracePeriodMs: parseDuration(defaults.stale_grace_period),
      trashRetentionMs: parseDuration(defaults.trash_retention),
      snapshotKeepLastN: defaults.snapshot_keep_last_n,
      snapshotKeepMinAgeMs: parseDuration(defaults.snapshot_keep_min_age),
      workspaceGenerationKeep: defaults.workspace_generation_keep,
    },
    perArtifactType: raw.per_artifact_type ?? {},
    pins: raw.pins ?? [],
    quotas: {
      maxDiskPerProjectBytes: parseBytes(quotas.max_disk_per_project),
      maxDiskGlobalBytes: parseBytes(quotas.max_disk_global),
    },
  };
}
