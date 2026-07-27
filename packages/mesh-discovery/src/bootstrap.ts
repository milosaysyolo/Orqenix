// SPDX-License-Identifier: Apache-2.0
// packages/mesh-discovery/src/bootstrap.ts
import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { multiaddr } from "@multiformats/multiaddr";

export interface ReconnectPolicy {
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface BootstrapConfig {
  bootstrap: string[];
  reconnect: ReconnectPolicy;
}

export const DEFAULT_RECONNECT: ReconnectPolicy = {
  initialDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffFactor: 2,
  jitter: true,
};

export function parseBootstrapYaml(text: string): BootstrapConfig {
  const raw = parseYaml(text);
  if (!raw || typeof raw !== "object") {
    throw new Error("bootstrap.yaml: expected an object at top level");
  }
  const obj = raw as Record<string, unknown>;

  const list = obj.bootstrap;
  if (!Array.isArray(list)) {
    throw new Error('bootstrap.yaml: "bootstrap" must be an array of multiaddr strings');
  }
  const addrs: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error("bootstrap.yaml: each bootstrap entry must be a non-empty string");
    }
    multiaddr(entry);
    addrs.push(entry);
  }

  const reconnect = parseReconnect(obj.reconnect);
  return { bootstrap: addrs, reconnect };
}

function parseReconnect(value: unknown): ReconnectPolicy {
  if (value == null) return { ...DEFAULT_RECONNECT };
  if (typeof value !== "object") {
    throw new Error('bootstrap.yaml: "reconnect" must be an object');
  }
  const r = value as Record<string, unknown>;

  const out: ReconnectPolicy = { ...DEFAULT_RECONNECT };

  if ("initial_delay_ms" in r)
    out.initialDelayMs = requirePositiveInt(r.initial_delay_ms, "initial_delay_ms");
  if ("max_delay_ms" in r) out.maxDelayMs = requirePositiveInt(r.max_delay_ms, "max_delay_ms");
  if ("backoff_factor" in r)
    out.backoffFactor = requirePositiveNumber(r.backoff_factor, "backoff_factor");
  if ("jitter" in r) {
    if (typeof r.jitter !== "boolean") throw new Error('bootstrap.yaml: "jitter" must be boolean');
    out.jitter = r.jitter;
  }

  if (out.maxDelayMs < out.initialDelayMs) {
    throw new Error("bootstrap.yaml: max_delay_ms must be >= initial_delay_ms");
  }
  return out;
}

function requirePositiveInt(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`bootstrap.yaml: ${name} must be a positive integer`);
  }
  return v;
}

function requirePositiveNumber(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new Error(`bootstrap.yaml: ${name} must be a positive number`);
  }
  return v;
}

export async function loadBootstrapFile(path: string): Promise<BootstrapConfig> {
  const text = await readFile(path, "utf8");
  return parseBootstrapYaml(text);
}

export function nextReconnectDelay(
  policy: ReconnectPolicy,
  attemptIndex: number,
  rand: () => number = Math.random,
): number {
  const expo = policy.initialDelayMs * Math.pow(policy.backoffFactor, attemptIndex);
  const capped = Math.min(policy.maxDelayMs, expo);
  if (!policy.jitter) return Math.floor(capped);
  const factor = 0.5 + rand();
  return Math.floor(Math.min(policy.maxDelayMs, capped * factor));
}
