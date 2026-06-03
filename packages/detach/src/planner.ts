// SPDX-License-Identifier: Apache-2.0
// @bc CS-025 Detach Planner
// @gate G17.1, G30.1

import { randomBytes } from "node:crypto";
import { blake3Bytes, canonicalJson } from "@orqenix/core";
import type { ScopeLinkStore } from "@orqenix/scope-link";
import type { WorkspaceStore } from "@orqenix/workspace";
import type { AuditLogStore } from "@orqenix/audit-log";
import { DetachPlanSchema, ConfirmationTokenPattern, type DetachPlan } from "./contracts.js";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function encodeBase32(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 0x1f];
  return out;
}

function makeConfirmationToken(planDigest: Uint8Array, salt: Uint8Array): string {
  const combined = new Uint8Array(planDigest.length + salt.length);
  combined.set(planDigest, 0);
  combined.set(salt, planDigest.length);
  const digest = blake3Bytes(combined).slice(0, 20);
  return `detach:${encodeBase32(digest)}`;
}

export interface DetachPlannerOptions {
  localScopeId: string;
  linkStore: ScopeLinkStore;
  workspaceStore: WorkspaceStore;
  auditStore?: AuditLogStore;
  now?: () => string;
}

export class DetachPlanner {
  private readonly localScopeId: string;
  private readonly linkStore: ScopeLinkStore;
  private readonly workspaceStore: WorkspaceStore;
  private readonly auditStore?: AuditLogStore;
  private readonly now: () => string;

  constructor(opts: DetachPlannerOptions) {
    this.localScopeId = opts.localScopeId;
    this.linkStore = opts.linkStore;
    this.workspaceStore = opts.workspaceStore;
    this.auditStore = opts.auditStore;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  planUnlink(remoteScopeId: string): DetachPlan {
    const links = this.linkStore
      .list({})
      .filter((l) => l.remoteScopeId === remoteScopeId && l.status !== "revoked");
    const memberships = this.workspaceStore
      .listForScope(this.localScopeId)
      .map((w) => this.workspaceStore.listMembers(w.id as any))
      .flat()
      .filter((m) => m.scopeId === remoteScopeId);

    return this.finalizePlan({
      kind: "unlink-remote",
      localScopeId: this.localScopeId,
      targetScopeId: remoteScopeId,
      affectedLinks: links.length,
      affectedTokens: 0,
      affectedMemberships: memberships.length,
      auditEntriesPreserved: this.auditStore?.count() ?? 0,
    });
  }

  planFullDetach(): DetachPlan {
    const links = this.linkStore.list({}).filter((l) => l.status !== "revoked");
    const myWorkspaces = this.workspaceStore.listForScope(this.localScopeId);
    let memberships = 0;
    for (const w of myWorkspaces) {
      memberships += this.workspaceStore.listMembers(w.id as any).length;
    }
    return this.finalizePlan({
      kind: "full-detach",
      localScopeId: this.localScopeId,
      affectedLinks: links.length,
      affectedTokens: 0,
      affectedMemberships: memberships,
      auditEntriesPreserved: this.auditStore?.count() ?? 0,
    });
  }

  private finalizePlan(partial: Omit<DetachPlan, "confirmationToken" | "preparedAt">): DetachPlan {
    const preparedAt = this.now();
    const planJson = canonicalJson({ ...partial, preparedAt });
    const digest = blake3Bytes(new TextEncoder().encode(planJson));
    const salt = new Uint8Array(randomBytes(16));
    const token = makeConfirmationToken(digest, salt);
    if (!ConfirmationTokenPattern.test(token)) {
      throw new Error(`invariant: derived token failed format check: ${token}`);
    }
    const plan: DetachPlan = { ...partial, preparedAt, confirmationToken: token };
    return DetachPlanSchema.parse(plan);
  }
}
