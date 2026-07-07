// packages/mesh-transport-core/src/envelope.ts
/**
 * Canonical msgpack envelope encode/decode.
 * Agent note: encoding rules per CR v7.2 Chapter 2.3: sorted keys, smallest int width,
 * binary as bin family, no floats. Encoded output must be byte-stable for equal inputs.
 */
import { Packr, Unpackr } from "msgpackr";
import { ulid } from "ulidx";
import type { MeshRequest, MeshResponse } from "./types.js";
import { canonicalize, bytesEqual } from "./canonical.js";

const packr = new Packr({
  useRecords: false,
  variableMapSize: true,
  encodeUndefinedAsNil: true,
});

const unpackr = new Unpackr({
  useRecords: false,
});

/** Generate a new ULID request id. */
export function newRequestId(): string {
  return ulid();
}

/** Reject any object containing non-integer numeric values. Envelope fields are integer or string. */
function assertNoFloats(value: unknown, path = "$"): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new Error(`envelope: non-integer number at ${path}`);
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (value instanceof Uint8Array) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoFloats(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    assertNoFloats(v, `${path}.${k}`);
  }
}

/** Structural validation for a MeshRequest. Cheap and synchronous. */
export function validateRequest(req: MeshRequest): void {
  if (!req || typeof req !== "object") throw new Error("envelope: request not an object");
  for (const k of ["id", "fromScope", "toScope", "capability", "method"] as const) {
    if (typeof req[k] !== "string" || req[k].length === 0) {
      throw new Error(`envelope: field ${k} missing or empty`);
    }
  }
  if (!(req.payload instanceof Uint8Array)) {
    throw new Error("envelope: payload must be Uint8Array");
  }
  if (!Number.isInteger(req.deadlineMs) || req.deadlineMs <= 0) {
    throw new Error("envelope: deadlineMs must be a positive integer");
  }
  if (!req.trace || typeof req.trace.traceparent !== "string") {
    throw new Error("envelope: trace.traceparent missing");
  }
}

export function validateResponse(resp: MeshResponse): void {
  if (!resp || typeof resp !== "object") throw new Error("envelope: response not an object");
  if (typeof resp.id !== "string" || resp.id.length === 0)
    throw new Error("envelope: response.id missing");
  if (!["ok", "denied", "error", "timeout"].includes(resp.status)) {
    throw new Error("envelope: response.status not in enum");
  }
}

export function encodeRequest(req: MeshRequest): Uint8Array {
  validateRequest(req);
  assertNoFloats(req);
  return packr.pack(canonicalize(req));
}

export function decodeRequest(buf: Uint8Array): MeshRequest {
  const obj = unpackr.unpack(buf) as MeshRequest;
  validateRequest(obj);
  return obj;
}

export function encodeResponse(resp: MeshResponse): Uint8Array {
  validateResponse(resp);
  assertNoFloats(resp);
  return packr.pack(canonicalize(resp));
}

export function decodeResponse(buf: Uint8Array): MeshResponse {
  const obj = unpackr.unpack(buf) as MeshResponse;
  validateResponse(obj);
  return obj;
}

/** Byte-equality helper for tests. */
export { bytesEqual } from "./canonical.js";
