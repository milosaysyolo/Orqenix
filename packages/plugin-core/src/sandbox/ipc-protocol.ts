// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , IPC protocol
//
// JSON-RPC-style message protocol between Workbench (host) and plugin (sandbox).
// Messages flow over stdin/stdout (newline-delimited JSON) per CR v8.0 Section 7.4.

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────
// Message kinds
// ─────────────────────────────────────────────────────────────────────────

export type IpcMessageKind =
  | 'handshake' // host → plugin: capability negotiation
  | 'handshake_ack' // plugin → host: handshake confirmed
  | 'invoke' // host → plugin: invoke a tool
  | 'invoke_result' // plugin → host: tool result
  | 'invoke_error' // plugin → host: tool error
  | 'permission_request' // plugin → host: request to use a permission
  | 'permission_response' // host → plugin: permission granted/denied
  | 'log' // plugin → host: structured log line
  | 'metrics' // plugin → host: resource usage report
  | 'shutdown' // host → plugin: graceful shutdown request
  | 'shutdown_ack'; // plugin → host: shutdown acknowledged

// ─────────────────────────────────────────────────────────────────────────
// Base message envelope
// ─────────────────────────────────────────────────────────────────────────

export interface IpcMessage {
  /** Protocol version (for forward/backward compat) */
  v: '1.0';
  /** Message kind */
  kind: IpcMessageKind;
  /** Correlation ID linking request → response */
  id: string;
  /** Timestamp (epoch ms) */
  ts: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Handshake (capability negotiation)
// ─────────────────────────────────────────────────────────────────────────

export interface IpcHandshakeMessage extends IpcMessage {
  kind: 'handshake';
  payload: {
    /** Granted permissions (plugin can only invoke these) */
    grantedPermissions: string[];
    /** Sandbox resource limits */
    limits: {
      cpuLimitPct: number;
      memoryLimitMb: number;
      wallTimeLimitSec: number;
    };
    /** Host protocol version */
    hostVersion: string;
  };
}

export interface IpcHandshakeAckMessage extends IpcMessage {
  kind: 'handshake_ack';
  payload: {
    /** Plugin name + version (echoed for verification) */
    pluginName: string;
    pluginVersion: string;
    /** Tools the plugin exposes */
    tools: string[];
    /** Plugin protocol version */
    pluginVersion_protocol: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Invoke request/response
// ─────────────────────────────────────────────────────────────────────────

export interface IpcRequestMessage extends IpcMessage {
  kind: 'invoke';
  payload: {
    toolName: string;
    input: unknown;
    /** Trace ID for audit + observability */
    traceId?: string;
  };
}

export interface IpcResponseMessage extends IpcMessage {
  kind: 'invoke_result';
  payload: {
    output: unknown;
  };
}

export interface IpcInvokeErrorMessage extends IpcMessage {
  kind: 'invoke_error';
  payload: {
    code: string;
    message: string;
    stack?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Permission request/response (runtime capability enforcement)
// ─────────────────────────────────────────────────────────────────────────

export interface IpcPermissionRequestMessage extends IpcMessage {
  kind: 'permission_request';
  payload: {
    permission: string;
    reason?: string;
  };
}

export interface IpcPermissionResponseMessage extends IpcMessage {
  kind: 'permission_response';
  payload: {
    permission: string;
    granted: boolean;
    reason?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Log + Metrics
// ─────────────────────────────────────────────────────────────────────────

export interface IpcLogMessage extends IpcMessage {
  kind: 'log';
  payload: {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    attrs?: Record<string, unknown>;
  };
}

export interface IpcMetricsMessage extends IpcMessage {
  kind: 'metrics';
  payload: {
    cpuUsagePct: number;
    memoryUsageMb: number;
    uptimeSec: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Shutdown
// ─────────────────────────────────────────────────────────────────────────

export interface IpcShutdownMessage extends IpcMessage {
  kind: 'shutdown';
  payload: {
    /** Graceful shutdown deadline in ms */
    deadlineMs: number;
  };
}

export interface IpcShutdownAckMessage extends IpcMessage {
  kind: 'shutdown_ack';
  payload: Record<string, never>;
}

// ─────────────────────────────────────────────────────────────────────────
// Zod schema for runtime validation of incoming messages
// ─────────────────────────────────────────────────────────────────────────

export const IpcMessageSchema = z.object({
  v: z.literal('1.0'),
  kind: z.enum([
    'handshake',
    'handshake_ack',
    'invoke',
    'invoke_result',
    'invoke_error',
    'permission_request',
    'permission_response',
    'log',
    'metrics',
    'shutdown',
    'shutdown_ack',
  ]),
  id: z.string().min(1),
  ts: z.number().int().positive(),
  payload: z.unknown(),
});

// ─────────────────────────────────────────────────────────────────────────
// Serialization helpers (newline-delimited JSON)
// ─────────────────────────────────────────────────────────────────────────

/** Serialize a message to a newline-terminated JSON line */
export function serializeMessage(msg: IpcMessage & { payload?: unknown }): string {
  return JSON.stringify(msg) + '\n';
}

/** Parse a single JSON line into a validated IpcMessage */
export function parseMessage(line: string): (IpcMessage & { payload: unknown }) | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const result = IpcMessageSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }

  return result.data as IpcMessage & { payload: unknown };
}

/** Generate a correlation ID for request/response linking */
export function generateMessageId(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}
