// packages/mesh-transport-core/src/errors.ts
/**
 * Typed error taxonomy and error-to-MeshResponse mapping.
 * Agent note: messages must be sanitized; no stack frames or filesystem paths.
 */
import type { MeshResponse, MeshStatus } from './types.js';

export const ErrorCode = {
  TRANSPORT: 'E_TRANSPORT',
  TIMEOUT: 'E_TIMEOUT',
  HANDLER: 'E_HANDLER',
  UNKNOWN: 'E_UNKNOWN',
  CAP_MISSING: 'E_CAP_MISSING',
  CAP_MALFORMED: 'E_CAP_MALFORMED',
  CAP_INVALID: 'E_CAP_INVALID',
  CAP_SIG_INVALID: 'E_CAP_SIG_INVALID',
  CAP_EXPIRED: 'E_CAP_EXPIRED',
  CAP_SUBJECT_MISMATCH: 'E_CAP_SUBJECT_MISMATCH',
  CAP_ISSUER_MISMATCH: 'E_CAP_ISSUER_MISMATCH',
  CAP_METHOD_NOT_ALLOWED: 'E_CAP_METHOD_NOT_ALLOWED',
  IDENTITY_SIG_INVALID: 'E_IDENTITY_SIG_INVALID',
  ENVELOPE_MISMATCH: 'E_ENVELOPE_MISMATCH',
  ILLEGAL_STATE: 'E_ILLEGAL_STATE',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class TransportError extends Error {
  readonly code: ErrorCodeValue;
  constructor(message: string, code: ErrorCodeValue = ErrorCode.TRANSPORT) {
    super(message);
    this.name = 'TransportError';
    this.code = code;
  }
}

export class CapabilityError extends Error {
  readonly code: ErrorCodeValue;
  constructor(message: string, code: ErrorCodeValue = ErrorCode.CAP_INVALID) {
    super(message);
    this.name = 'CapabilityError';
    this.code = code;
  }
}

export class DeadlineExceeded extends Error {
  readonly code = ErrorCode.TIMEOUT;
  constructor(message = 'deadline exceeded') {
    super(message);
    this.name = 'DeadlineExceeded';
  }
}

export class HandlerError extends Error {
  readonly code = ErrorCode.HANDLER;
  constructor(message: string) {
    super(message);
    this.name = 'HandlerError';
  }
}

export class IllegalStateError extends Error {
  readonly code = ErrorCode.ILLEGAL_STATE;
  constructor(message: string) {
    super(message);
    this.name = 'IllegalStateError';
  }
}

/** Strip stack frames and filesystem paths from a free-form message. */
function sanitize(msg: string): string {
  // Remove anything that looks like a stack frame: "at foo (path:line)" or "/abs/path.ts"
  const noFrames = msg.replace(/\s*at\s+\S+\s*\([^)]*\)/g, '');
  const noPaths = noFrames.replace(/(?:\/|\\)[\w./\\-]+\.(?:ts|js|mjs|cjs)/g, '<file>');
  return noPaths.split('\n')[0].trim().slice(0, 256);
}

/** Map a thrown error into a MeshResponse with the correct status and a sanitized message. */
export function toMeshResponse(id: string, err: unknown): MeshResponse {
  let status: MeshStatus = 'error';
  let code: ErrorCodeValue = ErrorCode.UNKNOWN;
  let raw = 'unknown error';

  if (err instanceof CapabilityError) {
    status = 'denied';
    code = err.code;
    raw = err.message;
  } else if (err instanceof DeadlineExceeded) {
    status = 'timeout';
    code = err.code;
    raw = err.message;
  } else if (err instanceof HandlerError) {
    status = 'error';
    code = err.code;
    raw = err.message;
  } else if (err instanceof TransportError) {
    status = 'error';
    code = err.code;
    raw = err.message;
  } else if (err instanceof IllegalStateError) {
    status = 'error';
    code = err.code;
    raw = err.message;
  } else if (err instanceof Error) {
    raw = err.message;
  }

  return {
    id,
    status,
    error: { code, message: sanitize(raw) },
  };
}
