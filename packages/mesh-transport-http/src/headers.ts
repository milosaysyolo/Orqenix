// packages/mesh-transport-http/src/headers.ts
/**
 * HTTP header names, content type, and header-versus-body cross-check.
 * Agent note: per CR v7.2 Chapter 3.3, headers duplicate values from the body for
 * defense-in-depth. The server must verify they match and reject mismatches.
 */
import { CapabilityError, ErrorCode, type MeshRequest } from '@orqenix/mesh-transport-core';

export const HDR = {
  CAPABILITY: 'x-orqenix-capability',
  SCOPE_SIG: 'x-orqenix-scope-sig',
  REQUEST_ID: 'x-orqenix-request-id',
  DEADLINE_MS: 'x-orqenix-deadline-ms',
  TRACEPARENT: 'traceparent',
  TRACESTATE: 'tracestate',
} as const;

export const CONTENT_TYPE = 'application/vnd.orqenix.mesh+msgpack';

export function b64urlEncode(bytes: Uint8Array | string): string {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64'));
}

export function buildHeaders(req: MeshRequest, scopeSigB64u: string): Record<string, string> {
  const h: Record<string, string> = {
    'content-type': CONTENT_TYPE,
    accept: CONTENT_TYPE,
    [HDR.CAPABILITY]: b64urlEncode(req.capability),
    [HDR.SCOPE_SIG]: scopeSigB64u,
    [HDR.REQUEST_ID]: req.id,
    [HDR.DEADLINE_MS]: String(req.deadlineMs),
    [HDR.TRACEPARENT]: req.trace.traceparent,
  };
  if (req.trace.tracestate) h[HDR.TRACESTATE] = req.trace.tracestate;
  return h;
}

export function assertHeadersMatchBody(
  headers: Record<string, string | string[] | undefined>,
  req: MeshRequest,
): void {
  const get = (k: string): string | undefined => {
    const v = headers[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const hdrId = get(HDR.REQUEST_ID);
  const hdrDeadline = get(HDR.DEADLINE_MS);
  const hdrCap = get(HDR.CAPABILITY);
  if (!hdrId || hdrId !== req.id) {
    throw new CapabilityError('request id header/body mismatch', ErrorCode.ENVELOPE_MISMATCH);
  }
  if (!hdrDeadline || Number(hdrDeadline) !== req.deadlineMs) {
    throw new CapabilityError('deadline header/body mismatch', ErrorCode.ENVELOPE_MISMATCH);
  }
  if (!hdrCap) {
    throw new CapabilityError('missing capability header', ErrorCode.CAP_MISSING);
  }
  const decoded = Buffer.from(b64urlDecode(hdrCap)).toString('utf8');
  if (decoded !== req.capability) {
    throw new CapabilityError('capability header/body mismatch', ErrorCode.ENVELOPE_MISMATCH);
  }
}
