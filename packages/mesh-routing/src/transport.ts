// SPDX-License-Identifier: Apache-2.0
// @bc CS-023 Transport
// @gate G34.1

import type { MeshQuery, MeshScopeOutcome, MeshScopeResult } from "./contracts.js";

export interface MeshTransportQueryOptions {
  tokenJti?: string;
  timeoutMs: number;
}

export interface MeshTransport {
  queryScope(
    targetScopeId: string,
    query: MeshQuery,
    opts: MeshTransportQueryOptions,
  ): Promise<MeshScopeOutcome>;
}

export type InMemoryScopeHandler = (
  q: MeshQuery,
) => Promise<MeshScopeResult["hits"]> | MeshScopeResult["hits"];

export class InMemoryMeshTransport implements MeshTransport {
  private readonly handlers: Map<string, InMemoryScopeHandler>;

  constructor(handlers: Record<string, InMemoryScopeHandler> = {}) {
    this.handlers = new Map(Object.entries(handlers));
  }

  setHandler(scopeId: string, handler: InMemoryScopeHandler): void {
    this.handlers.set(scopeId, handler);
  }

  async queryScope(
    targetScopeId: string,
    query: MeshQuery,
    opts: MeshTransportQueryOptions,
  ): Promise<MeshScopeOutcome> {
    const started = Date.now();
    const handler = this.handlers.get(targetScopeId);
    if (!handler) {
      return {
        scopeId: targetScopeId,
        ok: false,
        reason: "transport",
        message: "no handler registered for scope",
        durationMs: Date.now() - started,
      };
    }
    try {
      const hits = await Promise.race([
        Promise.resolve(handler(query)),
        new Promise<never>((_, rej) =>
          setTimeout(
            () => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })),
            opts.timeoutMs,
          ),
        ),
      ]);
      return {
        scopeId: targetScopeId,
        ok: true,
        hits,
        durationMs: Date.now() - started,
      };
    } catch (e) {
      const err = e as Error;
      const reason: "timeout" | "auth" | "transport" =
        err.name === "TimeoutError" ? "timeout" : err.name === "AuthError" ? "auth" : "transport";
      return {
        scopeId: targetScopeId,
        ok: false,
        reason,
        message: err.message,
        durationMs: Date.now() - started,
      } as MeshScopeOutcome;
    }
  }
}
