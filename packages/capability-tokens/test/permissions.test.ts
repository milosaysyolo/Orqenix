import { describe, it, expect } from 'vitest';
import {
  matchesCapability,
  parseCapability,
  tokenGrants,
  requireCapability,
  canDelegate,
  nextDelegationDepth,
} from '../src/permissions';
import {
  InsufficientCapabilityError,
  DelegationDepthExceededError,
  type CapabilityToken,
  type TokenPayload,
} from '../src/contracts';

function tok(caps: string[], maxDelegationDepth = 0): CapabilityToken {
  const payload: TokenPayload = {
    iss: 'scope:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    sub: 'scope:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    aud: 'scope:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    iat: 1000, nbf: 1000, exp: 2000,
    jti: 'tok:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    caps,
    maxDelegationDepth,
  };
  return { header: { alg: 'EdDSA', typ: 'ORQX', kid: payload.iss }, payload, signature: new Uint8Array(64) };
}

describe('permissions', () => {
  it('parses each of the 6 action types', () => {
    for (const action of ['read', 'write', 'delegate', 'query', 'distill', 'mesh']) {
      const c = parseCapability(`${action}:kb-docs`);
      expect(c.action).toBe(action);
    }
  });

  it('exact match', () => {
    expect(matchesCapability('read:kb-docs', 'read:kb-docs')).toBe(true);
  });

  it('action mismatch', () => {
    expect(matchesCapability('read:kb-docs', 'write:kb-docs')).toBe(false);
  });

  it('resource wildcard', () => {
    expect(matchesCapability('read:*', 'read:kb-decisions')).toBe(true);
    expect(matchesCapability('read:*', 'write:kb-decisions')).toBe(false);
  });

  it('scope pattern glob match', () => {
    expect(matchesCapability('write:kb-decisions:project-*', 'write:kb-decisions:project-alpha')).toBe(true);
    expect(matchesCapability('write:kb-decisions:project-*', 'write:kb-decisions:other-alpha')).toBe(false);
  });

  it('tokenGrants returns true when any cap matches', () => {
    expect(tokenGrants(tok(['read:kb-docs', 'write:*']), 'write:kb-decisions')).toBe(true);
  });

  it('requireCapability throws InsufficientCapabilityError', () => {
    expect(() => requireCapability(tok(['read:kb-docs']), 'write:kb-docs')).toThrow(InsufficientCapabilityError);
  });

  it('canDelegate requires both cap and depth', () => {
    expect(canDelegate(tok(['delegate:*'], 0))).toBe(false);
    expect(canDelegate(tok(['delegate:*'], 1))).toBe(true);
    expect(canDelegate(tok(['read:kb-docs'], 5))).toBe(false);
  });

  it('nextDelegationDepth decrements and throws when negative', () => {
    expect(nextDelegationDepth(3)).toBe(2);
    expect(() => nextDelegationDepth(0)).toThrow(DelegationDepthExceededError);
  });
});
