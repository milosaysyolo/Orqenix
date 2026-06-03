import {
  type Capability,
  type CapabilityToken,
  type EncodedToken,
  type TokenHeader,
  type TokenPayload,
  CapabilitySchema,
} from './contracts.js';
import { computeJti, encodeToken } from './format.js';
import { signToken } from './signing.js';
import {
  canDelegate,
  matchesCapability,
  nextDelegationDepth,
  requireCapability,
} from './permissions.js';
import { z } from 'zod';

export interface IssueTokenOptions {
  issuerScopeId: string;
  issuerPrivateKey: Uint8Array;
  subjectScopeId: string;
  audienceScopeId: string;
  caps: Capability[];
  ttlSeconds: number;
  notBeforeSeconds?: number;
  maxDelegationDepth?: number;
  now?: () => number;
}

export interface IssuedToken {
  token: CapabilityToken;
  encoded: EncodedToken;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export async function issueToken(opts: IssueTokenOptions): Promise<IssuedToken> {
  const capsParsed = z.array(CapabilitySchema).min(1).max(64).parse(opts.caps);
  if (opts.ttlSeconds <= 0) throw new Error('ttlSeconds must be > 0');
  if (opts.ttlSeconds > 365 * 24 * 3600) throw new Error('ttlSeconds must be <= 1 year');

  const now = (opts.now ?? nowSec)();
  const nbfOffset = opts.notBeforeSeconds ?? 0;
  const exp = now + opts.ttlSeconds;
  const nbf = now + nbfOffset;
  const maxDelegationDepth = opts.maxDelegationDepth ?? 0;

  const header: TokenHeader = { alg: 'EdDSA', typ: 'ORQX', kid: opts.issuerScopeId };

  const payloadWithoutJti = {
    iss: opts.issuerScopeId,
    sub: opts.subjectScopeId,
    aud: opts.audienceScopeId,
    iat: now,
    nbf,
    exp,
    caps: capsParsed,
    maxDelegationDepth,
  } as Omit<TokenPayload, 'jti'>;
  const jti = computeJti(payloadWithoutJti);
  const payload: TokenPayload = { ...payloadWithoutJti, jti } as TokenPayload;

  const token = await signToken({ header, payload, privateKey: opts.issuerPrivateKey });
  return { token, encoded: encodeToken(token) };
}

export interface DelegateTokenOptions {
  parentToken: CapabilityToken;
  parentPrivateKey: Uint8Array;
  newSubjectScopeId: string;
  caps: Capability[];
  ttlSeconds: number;
  notBeforeSeconds?: number;
  now?: () => number;
}

export async function delegateToken(opts: DelegateTokenOptions): Promise<IssuedToken> {
  if (!canDelegate(opts.parentToken)) {
    throw new Error('parent token does not grant delegation or maxDelegationDepth is 0');
  }
  for (const c of opts.caps) {
    const parentGrants = opts.parentToken.payload.caps.some((p) => matchesCapability(p, c));
    if (!parentGrants) {
      requireCapability(opts.parentToken, c);
    }
  }
  const childDepth = nextDelegationDepth(opts.parentToken.payload.maxDelegationDepth);
  const parentExp = opts.parentToken.payload.exp;
  const now = (opts.now ?? nowSec)();
  const cappedTtl = Math.min(opts.ttlSeconds, parentExp - now);
  if (cappedTtl <= 0) throw new Error('parent token already expired or ttl is non-positive');

  return issueToken({
    issuerScopeId: opts.parentToken.payload.sub,
    issuerPrivateKey: opts.parentPrivateKey,
    subjectScopeId: opts.newSubjectScopeId,
    audienceScopeId: opts.parentToken.payload.aud,
    caps: opts.caps,
    ttlSeconds: cappedTtl,
    notBeforeSeconds: opts.notBeforeSeconds,
    maxDelegationDepth: childDepth,
    now: opts.now,
  });
}
