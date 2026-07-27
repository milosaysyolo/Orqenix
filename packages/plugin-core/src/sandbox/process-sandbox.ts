// SPDX-License-Identifier: Apache-2.0
// @orqenix/plugin-core , Process sandbox
//
// Runs a plugin in a separate Node.js child process per ADR-E-004 +
// Anti-pattern 29. Communicates via newline-delimited JSON over stdin/stdout.

import { spawn, type ChildProcess } from "node:child_process";
import { blake3 } from "@noble/hashes/blake3";

import type { CanonicalSkillFormat } from "../csf-schema";
import { PermissionChecker } from "../permissions";
import type {
  PluginInvocationRequest,
  PluginInvocationResult,
  PluginRuntimeHandle,
  RuntimeMetrics,
} from "../types";
import {
  PluginActivateFailedError,
  PluginCrashedError,
  PluginTimeoutError,
} from '../errors';
import {
  type ResolvedResourceLimits,
  buildSpawnEnv,
  memoryLimitFlag,
} from './resource-limits';
import {
  type IpcMessage,
  type IpcResponseMessage,
  type IpcInvokeErrorMessage,
  serializeMessage,
  parseMessage,
  generateMessageId,
} from "./ipc-protocol";

export interface ProcessSandboxOptions {
  csf: CanonicalSkillFormat;
  entryPath: string;
  limits: ResolvedResourceLimits;
  /** Node executable (default: process.execPath) */
  nodeBin?: string;
  /** Callback on plugin crash */
  onCrash?: (event: {
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stderr: string;
    uptimeMs: number;
  }) => void;
}

/**
 * A single plugin running in a separate Node.js process.
 *
 * INV-14 guarantee: this process can crash without affecting the host.
 * The host catches 'exit' and 'error' events and never re-throws them
 * outside the onCrash callback.
 */
export class ProcessSandbox implements PluginRuntimeHandle {
  readonly csf: CanonicalSkillFormat;
  pid = -1;
  spawnedAt = "";

  private child: ChildProcess | null = null;
  private readonly entryPath: string;
  private readonly limits: ResolvedResourceLimits;
  private readonly nodeBin: string;
  private readonly permissionChecker: PermissionChecker;
  private readonly onCrash: ProcessSandboxOptions["onCrash"] | undefined;

  private stdoutBuffer = "";
  private stderrBuffer = "";
  private spawnTimeMs = 0;
  private terminated = false;

  /** Map of correlation ID → pending invocation resolver */
  private pending: Map<
    string,
    {
      resolve: (result: PluginInvocationResult) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      startMs: number;
      inputHash: string;
    }
  > = new Map();

  constructor(options: ProcessSandboxOptions) {
    this.csf = options.csf;
    this.entryPath = options.entryPath;
    this.limits = options.limits;
    this.nodeBin = options.nodeBin ?? process.execPath;
    this.permissionChecker = new PermissionChecker(options.csf.manifest.permissions);
    this.onCrash = options.onCrash;
  }

  /** Spawns the plugin process and performs handshake */
  async spawn(): Promise<void> {
    if (this.csf.manifest.sandboxMode === "in_process_trusted") {
      // Anti-pattern 29: refuse in-process loading for installed plugins
      throw new PluginActivateFailedError(
        this.csf.name,
        "in_process_trusted sandbox is forbidden for installed plugins (Anti-pattern 29). Use separate_process.",
      );
    }

    this.spawnTimeMs = Date.now();
    this.spawnedAt = new Date().toISOString();

    const env = buildSpawnEnv(this.limits, this.csf.manifest.permissions);
    const args = [memoryLimitFlag(this.limits), this.entryPath];

    try {
      this.child = spawn(this.nodeBin, args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        // Detached false: child dies if host dies
        detached: false,
      });
    } catch (err) {
      throw new PluginActivateFailedError(
        this.csf.name,
        `Failed to spawn process: ${(err as Error).message}`,
        err,
      );
    }

    this.pid = this.child.pid ?? -1;

    this.wireProcessEvents();

    // Perform handshake (host → plugin)
    await this.handshake();
  }

  /** Invokes a tool on the plugin */
  async invoke(request: PluginInvocationRequest): Promise<PluginInvocationResult> {
    if (this.terminated || !this.child) {
      throw new PluginActivateFailedError(this.csf.name, "Cannot invoke: sandbox is terminated");
    }

    const id = generateMessageId();
    const timeoutMs = request.timeoutMs ?? this.limits.wallTimeLimitSec * 1000;
    const startMs = Date.now();

    const inputCanonical = JSON.stringify(request.input);
    const inputHash = this.hash(inputCanonical);

    return new Promise<PluginInvocationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new PluginTimeoutError(this.csf.name, timeoutMs));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, startMs, inputHash });

      const msg = {
        v: "1.0" as const,
        kind: "invoke" as const,
        id,
        ts: Date.now(),
        payload: {
          toolName: request.toolName ?? this.csf.manifest.tool?.name ?? "default",
          input: request.input,
          ...(request.traceId ? { traceId: request.traceId } : {}),
        },
      };

      this.send(msg);
    });
  }

  /** Returns current resource usage metrics */
  async getMetrics(): Promise<RuntimeMetrics> {
    const uptimeSec = (Date.now() - this.spawnTimeMs) / 1000;
    // Node doesn't easily expose per-child CPU; report uptime + RSS estimate.
    // Production wires process.resourceUsage() via the metrics IPC message.
    return {
      cpuUsagePct: 0, // populated by metrics IPC message in production
      memoryUsageMb: 0,
      uptimeSec,
    };
  }

  /** Gracefully terminates the plugin process */
  async terminate(): Promise<void> {
    if (this.terminated || !this.child) return;
    this.terminated = true;

    // Reject any pending invocations
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new PluginActivateFailedError(this.csf.name, "Sandbox terminated"));
    }
    this.pending.clear();

    // Send graceful shutdown
    const shutdownId = generateMessageId();
    this.send({
      v: "1.0",
      kind: "shutdown",
      id: shutdownId,
      ts: Date.now(),
      payload: { deadlineMs: 5000 },
    });

    // Give plugin 5s to exit gracefully, then SIGKILL
    await new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        this.child?.kill("SIGKILL");
        resolve();
      }, 5000);

      this.child?.once("exit", () => {
        clearTimeout(killTimer);
        resolve();
      });
    });

    this.child = null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────

  private async handshake(): Promise<void> {
    const id = generateMessageId();
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new PluginActivateFailedError(
            this.csf.name,
            "Handshake timed out (plugin did not respond within 5s)",
          ),
        );
      }, 5000);

      // Store handshake as a pending op that resolves on handshake_ack
      this.pending.set(id, {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
        startMs: Date.now(),
        inputHash: "",
      });

      this.send({
        v: "1.0",
        kind: "handshake",
        id,
        ts: Date.now(),
        payload: {
          grantedPermissions: this.csf.manifest.permissions,
          limits: {
            cpuLimitPct: this.limits.cpuLimitPct,
            memoryLimitMb: this.limits.memoryLimitMb,
            wallTimeLimitSec: this.limits.wallTimeLimitSec,
          },
          hostVersion: "1.0",
        },
      });
    });
  }

  private wireProcessEvents(): void {
    if (!this.child) return;

    this.child.stdout?.on("data", (chunk: Buffer) => {
      this.stdoutBuffer += chunk.toString("utf-8");
      this.processStdoutLines();
    });

    this.child.stderr?.on("data", (chunk: Buffer) => {
      this.stderrBuffer += chunk.toString("utf-8");
      // Bound stderr buffer to prevent unbounded growth
      if (this.stderrBuffer.length > 64 * 1024) {
        this.stderrBuffer = this.stderrBuffer.slice(-64 * 1024);
      }
    });

    // INV-14: crash is caught here, never propagated outside onCrash
    this.child.on("exit", (code, signal) => {
      if (this.terminated) return; // expected exit during terminate()
      this.handleUnexpectedExit(code, signal);
    });

    this.child.on("error", (err) => {
      if (this.terminated) return;
      this.handleUnexpectedExit(null, null, err.message);
    });
  }

  private handleUnexpectedExit(
    code: number | null,
    signal: NodeJS.Signals | null,
    errMsg?: string,
  ): void {
    this.terminated = true;
    const uptimeMs = Date.now() - this.spawnTimeMs;
    const stderr = errMsg ? `${errMsg}\n${this.stderrBuffer}` : this.stderrBuffer;

    // Reject all pending invocations with a crash error
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new PluginCrashedError(this.csf.name, code, signal, stderr));
    }
    this.pending.clear();

    // Notify crash callback (INV-14: isolated, never re-thrown)
    if (this.onCrash) {
      try {
        this.onCrash({ exitCode: code, signal, stderr, uptimeMs });
      } catch {
        // Callback failure isolated
      }
    }
  }

  private processStdoutLines(): void {
    let newlineIdx: number;
    while ((newlineIdx = this.stdoutBuffer.indexOf("\n")) !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIdx);
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1);
      const msg = parseMessage(line);
      if (msg) {
        this.handleIncomingMessage(msg);
      }
    }
  }

  private handleIncomingMessage(msg: IpcMessage & { payload: unknown }): void {
    switch (msg.kind) {
      case "handshake_ack": {
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          pending.resolve({} as PluginInvocationResult);
        }
        break;
      }
      case "invoke_result": {
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          clearTimeout(pending.timer);
          const result = msg as IpcResponseMessage;
          const outputCanonical = JSON.stringify(result.payload.output);
          pending.resolve({
            output: result.payload.output,
            durationMs: Date.now() - pending.startMs,
            inputHash: pending.inputHash,
            outputHash: this.hash(outputCanonical),
          });
        }
        break;
      }
      case "invoke_error": {
        const pending = this.pending.get(msg.id);
        if (pending) {
          this.pending.delete(msg.id);
          clearTimeout(pending.timer);
          const errMsg = msg as IpcInvokeErrorMessage;
          pending.reject(
            new Error(
              `Plugin ${this.csf.name} error [${errMsg.payload.code}]: ${errMsg.payload.message}`,
            ),
          );
        }
        break;
      }
      case "permission_request": {
        // Runtime permission check (defense in depth)
        const payload = msg.payload as { permission: string };
        const granted = this.permissionChecker.has(payload.permission);
        this.send({
          v: "1.0",
          kind: "permission_response",
          id: msg.id,
          ts: Date.now(),
          payload: {
            permission: payload.permission,
            granted,
            ...(granted ? {} : { reason: "Permission not in granted set" }),
          },
        });
        break;
      }
      case "log": {
        // Plugin logs forwarded to host logger (production wires observability)
        break;
      }
      case "metrics": {
        // Plugin metrics recorded (production wires observability)
        break;
      }
      default:
        // Unknown message kind ignored
        break;
    }
  }

  private send(msg: IpcMessage & { payload: unknown }): void {
    if (!this.child?.stdin?.writable) return;
    this.child.stdin.write(serializeMessage(msg));
  }

  private hash(s: string): string {
    const bytes = new TextEncoder().encode(s);
    const h = blake3(bytes);
    return Array.from(h)
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
