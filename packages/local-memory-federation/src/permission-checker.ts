// SPDX-License-Identifier: Apache-2.0
// @orqenix/local-memory-federation , Permission checker
//
// Verifies cross-project federation is approved before any data crosses
// project boundaries. Per CR v8.0 ADR-E-011 + INV-18.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import { FederationApproval, FederationApprovalsYamlSchema, KbKind, ProjectId } from "./types";
import { ExpiredApprovalError, NoApprovalError, RegistryError } from "./errors";

export interface PermissionCheckInput {
  sourceProjectId: ProjectId;
  targetProjectId: ProjectId;
  kind: KbKind;
}

export interface PermissionCheckResult {
  allowed: boolean;
  approval?: FederationApproval;
  reason?: string;
}

/**
 * Reads ~/.orqenix/federation-approvals.yaml and verifies cross-project
 * sharing permissions before queries execute.
 */
export class PermissionChecker {
  private readonly approvalsPath: string;
  private cachedApprovals: FederationApproval[] | null = null;
  private cacheLoadedAt = 0;
  private readonly cacheTtlMs = 30_000; // 30s cache; approvals don't change often

  constructor(approvalsPath?: string) {
    this.approvalsPath = approvalsPath ?? join(homedir(), ".orqenix", "federation-approvals.yaml");
  }

  /** Checks if cross-project federation is allowed for the given pair + kind */
  async check(input: PermissionCheckInput): Promise<PermissionCheckResult> {
    const approvals = await this.loadApprovals();
    const now = new Date().toISOString();

    // Find approval matching source → target direction (unidirectional)
    const matching = approvals.find(
      (a) =>
        a.source_project_id === input.sourceProjectId &&
        a.target_project_id === input.targetProjectId,
    );

    if (!matching) {
      return {
        allowed: false,
        reason: "NO_APPROVAL",
      };
    }

    // Check expiration
    if (matching.expires_at < now) {
      return {
        allowed: false,
        approval: matching,
        reason: "EXPIRED",
      };
    }

    // Check per-KB scope
    if (!matching.scope[input.kind]) {
      return {
        allowed: false,
        approval: matching,
        reason: `KB_NOT_IN_SCOPE: ${input.kind}`,
      };
    }

    return {
      allowed: true,
      approval: matching,
    };
  }

  /** Throws on failure, returns silently on success */
  async assert(input: PermissionCheckInput): Promise<void> {
    const result = await this.check(input);
    if (!result.allowed) {
      if (result.reason === "EXPIRED" && result.approval) {
        throw new ExpiredApprovalError(result.approval.expires_at);
      }
      throw new NoApprovalError(input.sourceProjectId, input.targetProjectId);
    }
  }

  /** Returns all approvals (for UI display) */
  async listApprovals(): Promise<FederationApproval[]> {
    return this.loadApprovals();
  }

  /** Records a new approval (or updates existing for same pair) */
  async grantApproval(approval: FederationApproval): Promise<void> {
    const dir = dirname(this.approvalsPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    const all = await this.loadApprovals();
    // Remove existing approval for same pair (replace, don't duplicate)
    const filtered = all.filter(
      (a) =>
        !(
          a.source_project_id === approval.source_project_id &&
          a.target_project_id === approval.target_project_id
        ),
    );

    const updated = [...filtered, approval];

    try {
      await writeFile(
        this.approvalsPath,
        stringifyYaml({ approvals: updated }, { indent: 2 }),
        "utf-8",
      );
      this.invalidateCache();
    } catch (err) {
      throw new RegistryError(`Failed to write approvals at ${this.approvalsPath}`, err);
    }
  }

  /** Revokes an approval (deletes entry) */
  async revokeApproval(sourceProjectId: ProjectId, targetProjectId: ProjectId): Promise<void> {
    const all = await this.loadApprovals();
    const filtered = all.filter(
      (a) => !(a.source_project_id === sourceProjectId && a.target_project_id === targetProjectId),
    );

    try {
      await writeFile(
        this.approvalsPath,
        stringifyYaml({ approvals: filtered }, { indent: 2 }),
        "utf-8",
      );
      this.invalidateCache();
    } catch (err) {
      throw new RegistryError(`Failed to write approvals at ${this.approvalsPath}`, err);
    }
  }

  private async loadApprovals(): Promise<FederationApproval[]> {
    const now = Date.now();
    if (this.cachedApprovals !== null && now - this.cacheLoadedAt < this.cacheTtlMs) {
      return this.cachedApprovals;
    }

    if (!existsSync(this.approvalsPath)) {
      this.cachedApprovals = [];
      this.cacheLoadedAt = now;
      return [];
    }

    let content: string;
    try {
      content = await readFile(this.approvalsPath, "utf-8");
    } catch (err) {
      throw new RegistryError(`Failed to read approvals at ${this.approvalsPath}`, err);
    }

    let parsed: unknown;
    try {
      parsed = parseYaml(content);
    } catch (err) {
      throw new RegistryError(`Failed to parse YAML in ${this.approvalsPath}`, err);
    }

    const validated = FederationApprovalsYamlSchema.safeParse(parsed);
    if (!validated.success) {
      throw new RegistryError(
        `Invalid schema in ${this.approvalsPath}: ${validated.error.message}`,
        validated.error,
      );
    }

    this.cachedApprovals = validated.data.approvals;
    this.cacheLoadedAt = now;
    return this.cachedApprovals;
  }

  private invalidateCache(): void {
    this.cachedApprovals = null;
    this.cacheLoadedAt = 0;
  }
}
