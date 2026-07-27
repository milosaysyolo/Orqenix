// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Permission system
//
// Extends Phase 6 capability tokens to plugins. Each plugin declares the
// permissions it needs in manifest.permissions; sandbox enforces at runtime.
//
// Per CR v8.0 Section 7.5 + Anti-pattern 40.

import { z } from "zod";

/**
 * Permission strings follow `resource.action[:scope]` convention.
 *
 * Examples:
 *   - "scope.read"             , Read project scope identity
 *   - "git.write"              , Modify git state
 *   - "command.execute:limited", Execute commands from a limited allowlist
 *   - "command.execute:full"   , Execute arbitrary commands (rarely granted)
 *   - "network.fetch"          , Make outbound HTTP requests
 *   - "fs.read:/path"          , Read filesystem subtree
 *   - "fs.write:/path"         , Write filesystem subtree
 *   - "memory.read:chat"       , Read ChatKB
 *   - "memory.write:lesson"    , Write LessonKB
 */
export type Permission = string;

export const PermissionSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*(:[\w/\-.*]+)?$/,
    "Permission must match `resource.action[:scope]` format",
  );

/**
 * Standard permission catalog (extensible).
 * Plugins may declare custom permissions matching the regex.
 */
export const STANDARD_PERMISSIONS = {
  // Scope identity
  SCOPE_READ: "scope.read",
  SCOPE_WRITE: "scope.write",

  // Memory access
  MEMORY_READ_CHAT: "memory.read:chat",
  MEMORY_READ_CODE: "memory.read:code",
  MEMORY_READ_DECISION: "memory.read:decision",
  MEMORY_READ_LESSON: "memory.read:lesson",
  MEMORY_WRITE_CHAT: "memory.write:chat",
  MEMORY_WRITE_CODE: "memory.write:code",
  MEMORY_WRITE_DECISION: "memory.write:decision",
  MEMORY_WRITE_LESSON: "memory.write:lesson",

  // Git
  GIT_READ: "git.read",
  GIT_WRITE: "git.write",

  // Commands (executable processes)
  COMMAND_EXECUTE_LIMITED: "command.execute:limited",
  COMMAND_EXECUTE_FULL: "command.execute:full",

  // Filesystem
  FS_READ: "fs.read",
  FS_WRITE: "fs.write",

  // Network
  NETWORK_FETCH: "network.fetch",

  // Audit chain
  AUDIT_READ: "audit.read",
  AUDIT_WRITE: "audit.write",
} as const;

/**
 * Validates a list of permissions against the schema.
 */
export function validatePermissions(permissions: string[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  for (const p of permissions) {
    const result = PermissionSchema.safeParse(p);
    if (!result.success) {
      errors.push(`Invalid permission '${p}': ${result.error.message}`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Permission checker enforces that a plugin only invokes permissions it
 * declared in manifest. Used by SandboxManager at IPC boundary.
 */
export class PermissionChecker {
  private readonly granted: Set<Permission>;

  constructor(declaredPermissions: Permission[]) {
    this.granted = new Set(declaredPermissions);
  }

  /**
   * Returns true if the action is in the granted set.
   * Supports prefix matching for scoped permissions:
   *   declared: "fs.read:/home/milo"
   *   requested: "fs.read:/home/milo/projects/orqenix" → allowed
   *   requested: "fs.read:/etc"                        → denied
   */
  has(requestedPermission: Permission): boolean {
    if (this.granted.has(requestedPermission)) {
      return true;
    }

    // Try prefix match for scoped permissions
    const [reqResource, reqScope] = splitPermission(requestedPermission);
    if (reqScope === undefined) {
      // No scope component, must be exact match (already checked)
      return false;
    }

    for (const grantedPerm of this.granted) {
      const [grantedResource, grantedScope] = splitPermission(grantedPerm);
      if (grantedResource !== reqResource) continue;
      if (grantedScope === undefined) {
        // Granted permission has no scope → covers all scopes for this resource
        return true;
      }
      // Scope prefix match (granted "fs.read:/home/milo" covers "/home/milo/x")
      if (reqScope === grantedScope || reqScope.startsWith(grantedScope + "/")) {
        return true;
      }
    }
    return false;
  }

  /**
   * Throws PermissionDeniedError if not granted.
   */
  assert(requestedPermission: Permission): void {
    if (!this.has(requestedPermission)) {
      throw new PermissionDeniedError(requestedPermission, Array.from(this.granted));
    }
  }

  /** Returns all granted permissions (for diagnostics) */
  list(): Permission[] {
    return Array.from(this.granted);
  }
}

function splitPermission(p: Permission): [string, string | undefined] {
  const idx = p.indexOf(":");
  if (idx === -1) {
    return [p, undefined];
  }
  return [p.slice(0, idx), p.slice(idx + 1)];
}

export class PermissionDeniedError extends Error {
  constructor(
    public readonly requested: Permission,
    public readonly granted: Permission[],
  ) {
    super(`Plugin requested permission '${requested}' not in granted set: [${granted.join(", ")}]`);
    this.name = "PermissionDeniedError";
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}
