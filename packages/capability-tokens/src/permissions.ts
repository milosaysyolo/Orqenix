import {
  type Action,
  type Capability,
  type CapabilityToken,
  type Resource,
  ACTIONS,
  CAPABILITY_PATTERN,
  InsufficientCapabilityError,
  DelegationDepthExceededError,
} from './contracts.js';

export interface ParsedCapability {
  readonly action: Action;
  readonly resource: Resource | string;
  readonly scopePattern?: string;
}

export function parseCapability(s: Capability): ParsedCapability {
  const m = CAPABILITY_PATTERN.exec(s);
  if (!m) throw new Error(`invalid capability: ${s}`);
  const action = m[1]! as Action;
  const resource = m[2]!;
  const scopePattern = m[3]?.slice(1);
  return { action, resource, scopePattern };
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function matchesCapability(granted: Capability, required: Capability): boolean {
  const g = parseCapability(granted);
  const r = parseCapability(required);
  if (g.action !== r.action) return false;
  if (g.resource !== '*' && g.resource !== r.resource) return false;
  if (g.scopePattern === undefined) return true;
  if (r.scopePattern === undefined) return g.scopePattern === '*';
  return globToRegExp(g.scopePattern).test(r.scopePattern);
}

export function tokenGrants(token: CapabilityToken, required: Capability): boolean {
  return token.payload.caps.some((c) => matchesCapability(c, required));
}

export function requireCapability(token: CapabilityToken, required: Capability): void {
  if (!tokenGrants(token, required)) {
    throw new InsufficientCapabilityError(required, token.payload.caps);
  }
}

export function canDelegate(token: CapabilityToken): boolean {
  if (token.payload.maxDelegationDepth <= 0) return false;
  return token.payload.caps.some((c) => c.startsWith('delegate:'));
}

export function nextDelegationDepth(parentDepth: number): number {
  const next = parentDepth - 1;
  if (next < 0) throw new DelegationDepthExceededError(parentDepth, 0);
  return next;
}

export function allActions(): readonly Action[] { return ACTIONS; }
