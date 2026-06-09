import { Packr, Unpackr } from 'msgpackr';
import type { ScopeId, CapabilityToken } from '@orqenix/mesh-transport-core';
import { canonicalize } from '@orqenix/mesh-transport-core';
import { b64urlDecode, b64urlEncode } from './ed25519.js';

const packr = new Packr({ useRecords: false });
const unpackr = new Unpackr({ useRecords: false });

export interface CapabilityTokenFields {
  iss: ScopeId;
  sub: ScopeId;
  caps: string[];
  exp: number;
  nbf?: number;
  jti: string;
  sig: string;
}

export function canonicalSigningBytes(token: Omit<CapabilityTokenFields, 'sig'>): Uint8Array {
  const stripped = {
    iss: token.iss,
    sub: token.sub,
    caps: [...token.caps].sort(),
    exp: token.exp,
    nbf: token.nbf,
    jti: token.jti,
  };
  return packr.pack(canonicalize(stripped));
}

export function encodeCapabilityToken(token: CapabilityTokenFields): CapabilityToken {
  return b64urlEncode(packr.pack(canonicalize(token))) as CapabilityToken;
}

export function decodeCapabilityToken(s: string): CapabilityTokenFields {
  const raw = unpackr.unpack(b64urlDecode(s)) as unknown;
  if (!raw || typeof raw !== 'object') throw new Error('cap-token: not an object');
  const o = raw as Record<string, unknown>;

  for (const k of ['iss', 'sub', 'jti', 'sig'] as const) {
    if (typeof o[k] !== 'string' || (o[k] as string).length === 0) {
      throw new Error(`cap-token: field ${k} missing or empty`);
    }
  }
  if (!Array.isArray(o.caps) || o.caps.some((c) => typeof c !== 'string')) {
    throw new Error('cap-token: caps must be string[]');
  }
  if (!Number.isInteger(o.exp) || (o.exp as number) <= 0) {
    throw new Error('cap-token: exp must be a positive integer');
  }
  if (o.nbf !== undefined && (!Number.isInteger(o.nbf) || (o.nbf as number) <= 0)) {
    throw new Error('cap-token: nbf must be a positive integer when present');
  }
  return {
    iss: o.iss as ScopeId,
    sub: o.sub as ScopeId,
    caps: o.caps as string[],
    exp: o.exp as number,
    nbf: o.nbf as number | undefined,
    jti: o.jti as string,
    sig: o.sig as string,
  };
}
