import type { ScopeId } from "@orqenix/mesh-transport-core";

export type MeshLogLevel = "debug" | "info" | "warn" | "error";

export type MeshEventName =
  | "transport.start"
  | "transport.stop"
  | "peer.connect"
  | "peer.disconnect"
  | "rpc.in"
  | "rpc.out"
  | "rpc.denied"
  | "discovery.found"
  | "discovery.lost"
  | "failover"
  | "circuit.open"
  | "circuit.halfopen"
  | "circuit.close";

export type MeshStatus = "ok" | "denied" | "error" | "timeout";

export const CANONICAL_EVENTS: ReadonlySet<MeshEventName> = new Set([
  "transport.start",
  "transport.stop",
  "peer.connect",
  "peer.disconnect",
  "rpc.in",
  "rpc.out",
  "rpc.denied",
  "discovery.found",
  "discovery.lost",
  "failover",
  "circuit.open",
  "circuit.halfopen",
  "circuit.close",
]);

export interface MeshLogEvent {
  ts: string;
  level: MeshLogLevel;
  event: MeshEventName;
  scopeId: ScopeId;
  peerId?: string;
  requestId?: string;
  transport: "http" | "libp2p" | "loopback" | string;
  method?: string;
  durationMs?: number;
  status?: MeshStatus;
  errorCode?: string;
}

export function validateLogEvent(value: unknown): string[] | null {
  const errs: string[] = [];
  if (!value || typeof value !== "object") {
    return ["event is not an object"];
  }
  const v = value as Record<string, unknown>;
  const allowed = new Set([
    "ts",
    "level",
    "event",
    "scopeId",
    "peerId",
    "requestId",
    "transport",
    "method",
    "durationMs",
    "status",
    "errorCode",
  ]);
  for (const k of Object.keys(v)) {
    if (!allowed.has(k)) errs.push(`unknown field: ${k}`);
  }

  if (typeof v.ts !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.ts)) {
    errs.push("ts must be ISO-8601 with ms precision and Z suffix");
  }
  if (!["debug", "info", "warn", "error"].includes(v.level as string)) {
    errs.push("level must be one of debug|info|warn|error");
  }
  if (typeof v.event !== "string" || !CANONICAL_EVENTS.has(v.event as MeshEventName)) {
    errs.push("event must be one of the canonical event names");
  }
  if (typeof v.scopeId !== "string" || v.scopeId.length === 0) {
    errs.push("scopeId required");
  }
  if (typeof v.transport !== "string" || v.transport.length === 0) {
    errs.push("transport required");
  }
  if (v.peerId !== undefined && typeof v.peerId !== "string")
    errs.push("peerId must be string when present");
  if (v.requestId !== undefined && typeof v.requestId !== "string")
    errs.push("requestId must be string when present");
  if (v.method !== undefined && typeof v.method !== "string")
    errs.push("method must be string when present");
  if (v.durationMs !== undefined && (typeof v.durationMs !== "number" || v.durationMs < 0)) {
    errs.push("durationMs must be a non-negative number when present");
  }
  if (
    v.status !== undefined &&
    !["ok", "denied", "error", "timeout"].includes(v.status as string)
  ) {
    errs.push("status must be one of ok|denied|error|timeout when present");
  }
  if (v.errorCode !== undefined && typeof v.errorCode !== "string") {
    errs.push("errorCode must be string when present");
  }
  return errs.length === 0 ? null : errs;
}
