import { parseVersion } from "./semver.js";

export interface SkillPin {
  name: string;
  version: string;
  source: string;
}

export interface Conflict {
  name: string;
  pins: SkillPin[];
  reason: "major-mismatch" | "version-downgrade" | "source-mismatch";
}

export function detectConflicts(pins: SkillPin[]): Conflict[] {
  const byName = new Map<string, SkillPin[]>();
  for (const p of pins) {
    const arr = byName.get(p.name) ?? [];
    arr.push(p);
    byName.set(p.name, arr);
  }
  const out: Conflict[] = [];
  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    const sources = new Set(group.map((g) => g.source));
    if (sources.size > 1) {
      out.push({ name, pins: group, reason: "source-mismatch" });
      continue;
    }
    const majors = new Set(group.map((g) => parseVersion(g.version).major));
    if (majors.size > 1) {
      out.push({ name, pins: group, reason: "major-mismatch" });
      continue;
    }
    const versions = new Set(group.map((g) => g.version));
    if (versions.size > 1) {
      out.push({ name, pins: group, reason: "version-downgrade" });
    }
  }
  return out;
}
