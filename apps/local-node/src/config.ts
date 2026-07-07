import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parseBootstrapYaml, type BootstrapConfig } from "@orqenix/mesh-discovery";

export type TransportKind = "http" | "libp2p";

export interface HttpTransportConfig {
  kind: "http";
  enabled: boolean;
  listen: string[];
  dedupCache?: { maxEntries: number };
}

export interface Libp2pTransportConfig {
  kind: "libp2p";
  enabled: boolean;
  listen: string[];
  limits?: {
    maxInboundStreamsPerConn?: number;
    maxOutboundStreamsPerConn?: number;
    idleConnectionTimeoutMs?: number;
  };
}

export interface TransportsConfig {
  transports: Array<HttpTransportConfig | Libp2pTransportConfig>;
  priority: TransportKind[];
  circuitBreaker: { failureThreshold: number; cooldownMs: number };
  deadlineDefaultMs: number;
}

const DEFAULT_PRIORITY: TransportKind[] = ["libp2p", "http"];

export async function loadTransportsConfig(path: string): Promise<TransportsConfig> {
  const text = await readFile(path, "utf8");
  const raw = parseYaml(text) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("transports.yaml: expected an object at top level");
  }
  const obj = raw as Record<string, unknown>;

  const transports = parseTransports(obj.transports);
  const priority = parsePriority(obj.priority);
  const cb = parseCircuitBreaker(obj.circuit_breaker ?? obj.circuitBreaker);
  const ddl = parseDeadline(obj.deadline_default_ms ?? obj.deadlineDefaultMs);

  return { transports, priority, circuitBreaker: cb, deadlineDefaultMs: ddl };
}

function parseTransports(value: unknown): TransportsConfig["transports"] {
  if (!Array.isArray(value)) {
    throw new Error('transports.yaml: "transports" must be an array');
  }
  const out: TransportsConfig["transports"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") throw new Error("transport entry not an object");
    const e = entry as Record<string, unknown>;
    if (e.kind !== "http" && e.kind !== "libp2p") {
      throw new Error(`transport.kind must be 'http' or 'libp2p' (got ${String(e.kind)})`);
    }
    if (typeof e.enabled !== "boolean") {
      throw new Error("transport.enabled must be boolean");
    }
    const listen = parseStringArray(e.listen, "transport.listen");

    if (e.kind === "http") {
      const dedupCache = e.dedup_cache ?? e.dedupCache;
      let dedup: HttpTransportConfig["dedupCache"];
      if (dedupCache && typeof dedupCache === "object") {
        const maxEntries =
          (dedupCache as Record<string, unknown>).max_entries ??
          (dedupCache as Record<string, unknown>).maxEntries;
        if (typeof maxEntries !== "number" || !Number.isInteger(maxEntries) || maxEntries <= 0) {
          throw new Error("transports.yaml: dedup_cache.max_entries must be positive integer");
        }
        dedup = { maxEntries };
      }
      out.push({ kind: "http", enabled: e.enabled, listen, dedupCache: dedup });
    } else {
      const limitsRaw = e.limits;
      let limits: Libp2pTransportConfig["limits"];
      if (limitsRaw && typeof limitsRaw === "object") {
        const lr = limitsRaw as Record<string, unknown>;
        limits = {
          maxInboundStreamsPerConn: optInt(lr, "max_inbound_streams_per_conn"),
          maxOutboundStreamsPerConn: optInt(lr, "max_outbound_streams_per_conn"),
          idleConnectionTimeoutMs: optInt(lr, "idle_connection_timeout_ms"),
        };
      }
      out.push({ kind: "libp2p", enabled: e.enabled, listen, limits });
    }
  }
  return out;
}

function parsePriority(value: unknown): TransportKind[] {
  if (value == null) return DEFAULT_PRIORITY.slice();
  if (!Array.isArray(value)) throw new Error('transports.yaml: "priority" must be an array');
  const out: TransportKind[] = [];
  for (const v of value) {
    if (v !== "http" && v !== "libp2p") throw new Error(`invalid priority entry: ${String(v)}`);
    out.push(v);
  }
  return out;
}

function parseCircuitBreaker(value: unknown): { failureThreshold: number; cooldownMs: number } {
  if (value == null) return { failureThreshold: 3, cooldownMs: 30_000 };
  if (typeof value !== "object") throw new Error("circuit_breaker must be an object");
  const r = value as Record<string, unknown>;
  const ft = r.failure_threshold ?? r.failureThreshold ?? 3;
  const cd = r.cooldown_ms ?? r.cooldownMs ?? 30_000;
  if (typeof ft !== "number" || !Number.isInteger(ft) || ft <= 0) {
    throw new Error("circuit_breaker.failure_threshold must be positive integer");
  }
  if (typeof cd !== "number" || !Number.isInteger(cd) || cd <= 0) {
    throw new Error("circuit_breaker.cooldown_ms must be positive integer");
  }
  return { failureThreshold: ft, cooldownMs: cd };
}

function parseDeadline(value: unknown): number {
  if (value == null) return 5_000;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("deadline_default_ms must be positive integer");
  }
  return value;
}

function parseStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of strings`);
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`${label} entries must be non-empty strings`);
    }
    out.push(v);
  }
  return out;
}

function optInt(r: Record<string, unknown>, key: string): number | undefined {
  const v = r[key];
  if (v == null) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${key} must be positive integer when present`);
  }
  return v;
}

export { loadBootstrapFile, type BootstrapConfig } from "@orqenix/mesh-discovery";
