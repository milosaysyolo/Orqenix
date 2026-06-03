// SPDX-License-Identifier: Apache-2.0
// @bc CS-025 Detach Executor
// @gate G17.2, G17.3, G30.2

import { readdir, unlink, rmdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScopeLinkStore } from '@orqenix/scope-link';
import type { WorkspaceStore } from '@orqenix/workspace';
import { AuditLogStore } from '@orqenix/audit-log';
import {
  DetachPlanSchema, DetachReportSchema,
  InvalidConfirmationError, DetachStateError,
  type DetachPlan, type DetachReport,
} from './contracts.js';

export interface DetachExecutorOptions {
  localScopeId: string;
  linkStore: ScopeLinkStore;
  workspaceStore: WorkspaceStore;
  auditStore?: AuditLogStore;
  rootDir?: string;
  now?: () => string;
}

export interface ExecuteOptions {
  dryRun?: boolean;
  preserveIdentityKey?: boolean;
}

const PRESERVED_FROM_FULL_DETACH = new Set(['identity.key']);

export class DetachExecutor {
  private readonly localScopeId: string;
  private readonly linkStore: ScopeLinkStore;
  private readonly workspaceStore: WorkspaceStore;
  private readonly auditStore?: AuditLogStore;
  private readonly rootDir?: string;
  private readonly now: () => string;

  constructor(opts: DetachExecutorOptions) {
    this.localScopeId = opts.localScopeId;
    this.linkStore = opts.linkStore;
    this.workspaceStore = opts.workspaceStore;
    this.auditStore = opts.auditStore;
    this.rootDir = opts.rootDir;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  async execute(plan: DetachPlan, providedToken: string, opts: ExecuteOptions = {}): Promise<DetachReport> {
    DetachPlanSchema.parse(plan);
    if (plan.localScopeId !== this.localScopeId) {
      throw new InvalidConfirmationError(`plan localScopeId ${plan.localScopeId} does not match executor ${this.localScopeId}`);
    }
    if (providedToken !== plan.confirmationToken) {
      throw new InvalidConfirmationError(`provided token does not match plan`);
    }

    const dryRun = !!opts.dryRun;
    const preserveIdentityKey = opts.preserveIdentityKey ?? true;

    if (plan.kind === 'unlink-remote') {
      if (!plan.targetScopeId) throw new DetachStateError('unlink-remote plan missing targetScopeId');
      await this.applyUnlink(plan.targetScopeId, dryRun);
    } else {
      await this.applyFullDetach(dryRun, preserveIdentityKey);
    }

    let verifierChainHash: string | null = null;
    if (this.auditStore) {
      const entry = this.auditStore.append({
        actorScopeId: this.localScopeId,
        eventKind: 'scope_detached',
        payload: {
          kind: plan.kind,
          targetScopeId: plan.targetScopeId,
          affectedLinks: plan.affectedLinks,
          affectedMemberships: plan.affectedMemberships,
          dryRun,
        },
      });
      verifierChainHash = entry.contentHash;
    }

    const report: DetachReport = {
      ...plan,
      executedAt: this.now(),
      verifierChainHash,
    };
    return DetachReportSchema.parse(report);
  }

  private async applyUnlink(remoteScopeId: string, dryRun: boolean): Promise<void> {
    const links = this.linkStore.list({}).filter(
      (l) => l.remoteScopeId === remoteScopeId && l.status !== 'revoked',
    );
    if (dryRun) return;
    for (const l of links) {
      this.linkStore.updateStatus(l.remoteScopeId, l.direction, 'revoked');
    }
  }

  private async applyFullDetach(dryRun: boolean, preserveIdentityKey: boolean): Promise<void> {
    if (dryRun) return;
    // 1. revoke all non-revoked links
    for (const l of this.linkStore.list({})) {
      if (l.status !== 'revoked') {
        this.linkStore.updateStatus(l.remoteScopeId, l.direction, 'revoked');
      }
    }
    // 2. delete workspaces owned by this scope
    const myWorkspaces = this.workspaceStore.listForScope(this.localScopeId);
    for (const w of myWorkspaces) {
      if (w.ownerScopeId === this.localScopeId) {
        this.workspaceStore.delete(w.id as any);
      }
    }
    // 3. remove .orqenix/ contents (preserving identity.key when requested)
    if (this.rootDir) {
      await this.removeOrqenixDir(this.rootDir, preserveIdentityKey);
    }
  }

  private async removeOrqenixDir(rootDir: string, preserveIdentityKey: boolean): Promise<void> {
    const orq = join(rootDir, '.orqenix');
    let entries;
    try { entries = await readdir(orq, { withFileTypes: true }); }
    catch { return; /* nothing to remove */ }

    for (const ent of entries) {
      const full = join(orq, ent.name);
      if (preserveIdentityKey && PRESERVED_FROM_FULL_DETACH.has(ent.name)) continue;
      if (ent.isDirectory()) {
        await this.recursiveRemove(full);
      } else {
        try { await unlink(full); } catch { /* swallow */ }
      }
    }
  }

  private async recursiveRemove(p: string): Promise<void> {
    let entries;
    try { entries = await readdir(p, { withFileTypes: true }); }
    catch { return; }
    for (const ent of entries) {
      const full = join(p, ent.name);
      if (ent.isDirectory()) await this.recursiveRemove(full);
      else { try { await unlink(full); } catch { /* swallow */ } }
    }
    try { await rmdir(p); } catch { /* swallow */ }
  }

  // Public utility for tests / CLI: verifies .orqenix folder state matches expectations
  async checkDirState(rootDir: string): Promise<{ exists: boolean; hasIdentityKey: boolean; otherEntryCount: number }> {
    const orq = join(rootDir, '.orqenix');
    try { await stat(orq); }
    catch { return { exists: false, hasIdentityKey: false, otherEntryCount: 0 }; }
    let entries;
    try { entries = await readdir(orq, { withFileTypes: true }); }
    catch { return { exists: true, hasIdentityKey: false, otherEntryCount: 0 }; }
    let hasIdentityKey = false;
    let other = 0;
    for (const ent of entries) {
      if (ent.name === 'identity.key') hasIdentityKey = true;
      else other++;
    }
    return { exists: true, hasIdentityKey, otherEntryCount: other };
  }
}
