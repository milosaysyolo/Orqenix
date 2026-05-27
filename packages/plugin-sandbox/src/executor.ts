import type { SandboxProfile } from "./profiles.js";
import { isPathAllowed } from "./profiles.js";

export type Operation =
  | { kind: "fs.read"; path: string }
  | { kind: "fs.write"; path: string }
  | { kind: "network"; url: string }
  | { kind: "subprocess"; command: string };

export interface AuditEntry {
  operation: Operation;
  allowed: boolean;
  reason?: string;
  timestamp: number;
}

export interface SandboxResult {
  allowed: boolean;
  reason?: string;
  audit: AuditEntry;
}

export function checkOperation(
  profile: SandboxProfile,
  op: Operation,
  now: number = Date.now()
): SandboxResult {
  let allowed = true;
  let reason: string | undefined;

  switch (op.kind) {
    case "fs.read":
      if (!profile.allowFsRead) {
        allowed = false;
        reason = "fs.read disabled";
      } else if (!isPathAllowed(profile, op.path)) {
        allowed = false;
        reason = "path not allowed";
      }
      break;
    case "fs.write":
      if (!profile.allowFsWrite) {
        allowed = false;
        reason = "fs.write disabled";
      } else if (!isPathAllowed(profile, op.path)) {
        allowed = false;
        reason = "path not allowed";
      }
      break;
    case "network":
      if (!profile.allowNetwork) {
        allowed = false;
        reason = "network disabled";
      }
      break;
    case "subprocess":
      if (!profile.allowSubprocess) {
        allowed = false;
        reason = "subprocess disabled";
      }
      break;
  }

  if (profile.auditMode) {
    allowed = true;
    if (!reason) reason = undefined;
  }

  const audit: AuditEntry = { operation: op, allowed, reason, timestamp: now };
  return { allowed, reason, audit };
}
