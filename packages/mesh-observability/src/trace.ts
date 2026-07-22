import { webcrypto } from 'node:crypto';
import type { TraceContext } from '@orqenix/mesh-transport-core';

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface ParsedTraceparent {
  version: '00';
  traceId: string;
  spanId: string;
  flags: string;
}

export function parseTraceparent(tp: string): ParsedTraceparent | null {
  const m = TRACEPARENT_RE.exec(tp);
  if (!m) return null;
  return { version: '00', traceId: m[1]!, spanId: m[2]!, flags: m[3]! };
}

export function validateTraceparent(tp: string): boolean {
  return parseTraceparent(tp) !== null;
}

export function formatTraceparent(p: ParsedTraceparent): string {
  return `00-${p.traceId}-${p.spanId}-${p.flags}`;
}

function randHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  webcrypto.getRandomValues(buf);
  return Buffer.from(buf).toString('hex');
}

export function newTraceparent(): string {
  return formatTraceparent({ version: '00', traceId: randHex(16), spanId: randHex(8), flags: '01' });
}

export function deriveChildSpan(parent: string): string {
  const p = parseTraceparent(parent);
  if (!p) return newTraceparent();
  return formatTraceparent({ ...p, spanId: randHex(8) });
}

export function buildOutgoingTraceContext(parent?: string): TraceContext {
  const traceparent = parent ? deriveChildSpan(parent) : newTraceparent();
  return { traceparent };
}

export function traceIdOf(traceparent: string): string | undefined {
  return parseTraceparent(traceparent)?.traceId;
}
