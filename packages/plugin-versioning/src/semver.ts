export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/;

export function parseVersion(v: string): ParsedVersion {
  const m = SEMVER_RE.exec(v.trim());
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return {
    major: parseInt(m[1]!, 10),
    minor: parseInt(m[2]!, 10),
    patch: parseInt(m[3]!, 10),
    prerelease: m[4],
  };
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) {
    return pa.prerelease.localeCompare(pb.prerelease);
  }
  return 0;
}

export function isCompatible(installed: string, required: string): boolean {
  const i = parseVersion(installed);
  const r = parseVersion(required);
  if (i.major !== r.major) return false;
  return compareVersions(installed, required) >= 0;
}
