// packages/mesh-transport-core/src/state-machine.ts
/**
 * Transport lifecycle state machine per CR v7.2 Chapter 2.4.
 * Agent note: this is the single place where state transitions are guarded.
 */
import { IllegalStateError } from "./errors.js";

export type TransportState = "Created" | "Starting" | "Running" | "Stopping" | "Stopped" | "Failed";

const ALLOWED: Record<TransportState, ReadonlyArray<TransportState>> = {
  Created: ["Starting", "Stopped"],
  Starting: ["Running", "Failed", "Stopping"],
  Running: ["Stopping", "Failed"],
  Stopping: ["Stopped"],
  Stopped: ["Starting"],
  Failed: ["Stopping"],
};

export class TransportLifecycle {
  private _state: TransportState = "Created";

  get state(): TransportState {
    return this._state;
  }

  transition(next: TransportState): void {
    const allowed = ALLOWED[this._state];
    if (!allowed.includes(next)) {
      throw new IllegalStateError(`illegal transport transition: ${this._state} -> ${next}`);
    }
    this._state = next;
  }

  /** start() is idempotent on Running; allowed on Created/Stopped. */
  assertCanStart(): boolean {
    if (this._state === "Running" || this._state === "Starting") return false; // no-op
    if (this._state === "Created" || this._state === "Stopped") return true;
    throw new IllegalStateError(`cannot start in state ${this._state}`);
  }

  /** stop() is idempotent on Stopped/Stopping; allowed almost anywhere else. */
  assertCanStop(): boolean {
    if (this._state === "Stopped" || this._state === "Stopping") return false; // no-op
    return true;
  }

  assertCanSend(): void {
    if (this._state !== "Running") {
      throw new IllegalStateError(`cannot send in state ${this._state}`);
    }
  }

  assertCanRegisterHandler(): void {
    if (this._state === "Stopping") {
      throw new IllegalStateError(`cannot register handler in state Stopping`);
    }
  }
}
