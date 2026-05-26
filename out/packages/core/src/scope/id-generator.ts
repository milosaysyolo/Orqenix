import { basename, normalize } from "node:path";
import { randomBytes } from "node:crypto";
import { blake3 } from "@noble/hashes/blake3";
import type { ScopeDescriptor, ScopeId } from "../types/scope.js";

/**
 * Deterministic, collision-resistant Scope ID generator.
 * Produces a ScopeId from a ScopeDescriptor using BLAKE3 hashing.
 * See CHAPTER 5 of the spec.
 *
 * @param d - Scope descriptor containing org, project, branch, worktree, session
 * @returns ScopeId with full path, hash, short hash, and normalized descriptor
 */
export function generateScopeId(d: ScopeDescriptor): ScopeId {
  const normalized: Required<ScopeDescriptor> = {
    org: d.org ?? "_default",
    project: normalize(d.project),
    branch: d.branch.replace(/[^a-zA-Z0-9_\-./]/g, "_"),
    worktree: normalize(d.worktree),
    session: d.session ?? generateSessionId(),
  };

  const projectName = basename(normalized.project) || "project";
  const worktreeName = basename(normalized.worktree) || "worktree";

  const full = [
    normalized.org,
    projectName,
    normalized.branch,
    worktreeName,
    normalized.session,
  ].join("/");

  const hashBytes = blake3(JSON.stringify(normalized), { dkLen: 16 });
  const hash = Buffer.from(hashBytes).toString("hex");
  const short = hash.slice(0, 8);

  return { full, hash, short, descriptor: normalized };
}

/**
 * Generate a new unique session ID.
 * Format: s-YYYYMMDDHHMMSS-{6 hex chars}
 *
 * @returns Session ID string
 */
export function generateSessionId(): string {
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const rand = randomBytes(3).toString("hex");
  return `s-${ts}-${rand}`;
}
