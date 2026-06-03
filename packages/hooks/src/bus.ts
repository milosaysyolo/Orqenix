// SPDX-License-Identifier: Apache-2.0
// @bc CS-012 Hook Bus
// @gate G14.1, G14.2

import { type HookListener, type HookName, type HookPayloadMap } from "./contracts.js";

type Unsubscribe = () => void;
type ErrorHandler = (event: HookName, error: unknown) => void;

export class HookBus {
  private readonly listeners = new Map<HookName, Set<HookListener<any>>>();
  private errorHandler: ErrorHandler | null = null;

  on<T extends HookName>(name: T, listener: HookListener<T>): Unsubscribe {
    let bucket = this.listeners.get(name);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(name, bucket);
    }
    bucket.add(listener as HookListener<any>);
    return () => this.off(name, listener);
  }

  off<T extends HookName>(name: T, listener: HookListener<T>): void {
    const bucket = this.listeners.get(name);
    if (bucket) bucket.delete(listener as HookListener<any>);
  }

  clear(name?: HookName): void {
    if (name) this.listeners.delete(name);
    else this.listeners.clear();
  }

  listenerCount(name: HookName): number {
    return this.listeners.get(name)?.size ?? 0;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  async emit<T extends HookName>(name: T, payload: HookPayloadMap[T]): Promise<void> {
    const bucket = this.listeners.get(name);
    if (!bucket || bucket.size === 0) return;
    const promises: Promise<void>[] = [];
    for (const listener of bucket) {
      promises.push(
        (async () => {
          try {
            await (listener as HookListener<T>)(payload);
          } catch (e) {
            if (this.errorHandler) {
              try {
                this.errorHandler(name, e);
              } catch {
                /* swallow */
              }
            }
          }
        })(),
      );
    }
    await Promise.all(promises);
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
