import { hash as blake3Hash } from "blake3-wasm";
import type { MeshRequest } from "@orqenix/mesh-transport-core";

export interface PayloadSummary {
  payloadSize: number;
  payloadHash: string;
}

export interface CapabilitySummary {
  jti?: string;
}

const FORBIDDEN_FIELD_NAMES = new Set([
  "capability",
  "cap",
  "token",
  "signature",
  "sig",
  "secret",
  "privateKey",
  "private_key",
  "seed",
  "scopeSeed",
  "payload",
  "payloadBytes",
]);

export function summarizePayload(bytes: Uint8Array | undefined): PayloadSummary | undefined {
  if (!bytes) return undefined;
  const digest = blake3Hash(bytes);
  return {
    payloadSize: bytes.length,
    payloadHash: Buffer.from(digest).toString("hex"),
  };
}

export function summarizeCapability(_token: unknown): CapabilitySummary | undefined {
  return { jti: undefined };
}

export function summarizeRequest(req: Pick<MeshRequest, "id" | "method" | "payload">): {
  requestId: string;
  method: string;
  payload?: PayloadSummary;
} {
  return {
    requestId: req.id,
    method: req.method,
    payload: summarizePayload(req.payload),
  };
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth-limited]";
  if (input == null) return input;
  if (input instanceof Uint8Array) return summarizePayload(input);
  if (Array.isArray(input)) return input.map((v) => redact(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (FORBIDDEN_FIELD_NAMES.has(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return input;
}

export function containsLeak(serialized: string): boolean {
  if (
    /"(capability|token|sig|signature|secret|privateKey|seed)"\s*:\s*"(?!\[redacted\])/.test(
      serialized,
    )
  ) {
    return true;
  }
  if (/"[A-Za-z0-9_-]{120,}"/.test(serialized)) {
    return true;
  }
  return false;
}
