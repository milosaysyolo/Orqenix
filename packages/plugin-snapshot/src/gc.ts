import type { SnapshotMeta } from "./snapshot.js";

export type State = "active" | "idle" | "deprecated" | "deleted";

export interface RetentionPolicy {
  idleAfterDays: number;
  deprecateAfterDays: number;
  deleteAfterDays: number;
  snapshotMaxCount: number;
}

export interface GcDecision {
  id: string;
  current: State;
  next: State;
  reason: string;
}

export function planGc(
  snapshots: SnapshotMeta[],
  states: Record<string, { state: State; lastTouchedAt: number }>,
  policy: RetentionPolicy,
  now: number = Date.now()
): GcDecision[] {
  const out: GcDecision[] = [];

  for (const s of snapshots) {
    const st = states[s.id] ?? { state: "active" as State, lastTouchedAt: s.createdAt };
    const daysSince = (now - st.lastTouchedAt) / 86400000;

    if (st.state === "active" && daysSince >= policy.idleAfterDays) {
      out.push({ id: s.id, current: "active", next: "idle", reason: `${daysSince.toFixed(0)}d idle` });
    } else if (st.state === "idle" && daysSince >= policy.deprecateAfterDays) {
      out.push({ id: s.id, current: "idle", next: "deprecated", reason: `${daysSince.toFixed(0)}d idle` });
    } else if (st.state === "deprecated" && daysSince >= policy.deleteAfterDays) {
      out.push({ id: s.id, current: "deprecated", next: "deleted", reason: `${daysSince.toFixed(0)}d deprecated` });
    }
  }

  // Enforce snapshotMaxCount by promoting oldest to deleted, but never the most recent 3
  const sorted = [...snapshots].sort((a, b) => b.createdAt - a.createdAt);
  const protectedIds = new Set(sorted.slice(0, 3).map((s) => s.id));
  if (sorted.length > policy.snapshotMaxCount) {
    const excess = sorted.slice(policy.snapshotMaxCount);
    for (const s of excess) {
      if (protectedIds.has(s.id)) continue;
      if (!out.find((d) => d.id === s.id)) {
        out.push({ id: s.id, current: "active", next: "deleted", reason: "snapshotMaxCount exceeded" });
      }
    }
  }
  return out;
}
