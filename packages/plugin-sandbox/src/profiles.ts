export type ProfileName = "strict" | "lenient" | "audit-only";

export interface SandboxProfile {
  name: ProfileName;
  allowFsRead: boolean;
  allowFsWrite: boolean;
  allowNetwork: boolean;
  allowSubprocess: boolean;
  allowedFsPaths: string[];
  blockedFsPaths: string[];
  auditMode: boolean;
}

export const PROFILES: Record<ProfileName, SandboxProfile> = {
  strict: {
    name: "strict",
    allowFsRead: true,
    allowFsWrite: false,
    allowNetwork: false,
    allowSubprocess: false,
    allowedFsPaths: [],
    blockedFsPaths: [],
    auditMode: false,
  },
  lenient: {
    name: "lenient",
    allowFsRead: true,
    allowFsWrite: true,
    allowNetwork: true,
    allowSubprocess: true,
    allowedFsPaths: [],
    blockedFsPaths: [],
    auditMode: false,
  },
  "audit-only": {
    name: "audit-only",
    allowFsRead: true,
    allowFsWrite: true,
    allowNetwork: true,
    allowSubprocess: true,
    allowedFsPaths: [],
    blockedFsPaths: [],
    auditMode: true,
  },
};

export function getProfile(name: ProfileName): SandboxProfile {
  return { ...PROFILES[name] };
}

export function isPathAllowed(
  profile: SandboxProfile,
  path: string
): boolean {
  for (const blocked of profile.blockedFsPaths) {
    if (path.startsWith(blocked)) return false;
  }
  if (profile.allowedFsPaths.length === 0) return true;
  return profile.allowedFsPaths.some((p) => path.startsWith(p));
}
