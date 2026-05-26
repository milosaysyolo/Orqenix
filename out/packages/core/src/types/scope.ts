/**
 * Scope hierarchy: Org → Project → Branch → Worktree → Session.
 * See CHAPTER 5 of the spec.
 */

export interface ScopeDescriptor {
  org?: string;
  project: string;
  branch: string;
  worktree: string;
  session?: string;
}

export interface ScopeId {
  /** Human-readable: "_default/ptb-platform/dev/wt-a/oc-s-001" */
  full: string;
  /** 32-char BLAKE3 hex */
  hash: string;
  /** First 8 chars of hash */
  short: string;
  descriptor: Required<ScopeDescriptor>;
}

export interface Cluster {
  id: string;
  name: string;
  description?: string;
  scopes: string[];
  createdAt: string;
  internalTopology: "mesh";
  queryPropagation: {
    allowReadFromMembers: boolean;
    allowWriteFromMembers: boolean;
  };
}

export interface ClusterNetwork {
  links: Array<{
    from: string;
    to: string;
    direction: "bidirectional" | "one-way";
    weight?: number;
    enabled: boolean;
  }>;
}
