// packages/mesh-transport-core/src/loopback.ts
/**
 * LoopbackTransport: in-process reference implementation.
 * Agent note: NOT a production transport. Used as a test harness and as a worked
 * example for Parts 2 to 4. It connects two local scopes through a shared in-process bus.
 */
import { TransportLifecycle } from './state-machine.js';
import { DeadlineExceeded, IllegalStateError, toMeshResponse } from './errors.js';
import type {
  MeshAddress,
  MeshRequest,
  MeshResponse,
  MeshTransport,
  PeerInfo,
  ScopeId,
  SendOpts,
  TransportCtx,
} from './types.js';

type Handler = (req: MeshRequest, ctx: TransportCtx) => Promise<MeshResponse>;

/** Shared in-process bus keyed by ScopeId. */
const BUS = new Map<ScopeId, Handler>();

export class LoopbackTransport implements MeshTransport {
  readonly kind = 'loopback' as const;
  readonly localScopeId: ScopeId;
  private lifecycle = new TransportLifecycle();
  private handler?: Handler;
  private connectedAt = 0;

  constructor(localScopeId: ScopeId) {
    this.localScopeId = localScopeId;
  }

  async start(): Promise<void> {
    if (!this.lifecycle.assertCanStart()) return; // idempotent
    this.lifecycle.transition('Starting');
    try {
      // Register on the bus only if a handler has been provided. If not yet,
      // we still go Running and register lazily in onRequest().
      if (this.handler) BUS.set(this.localScopeId, this.handler);
      this.connectedAt = Date.now();
      this.lifecycle.transition('Running');
    } catch (e) {
      this.lifecycle.transition('Failed');
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.lifecycle.assertCanStop()) return; // idempotent
    this.lifecycle.transition('Stopping');
    try {
      BUS.delete(this.localScopeId);
      this.handler = undefined;
      this.connectedAt = 0;
    } finally {
      this.lifecycle.transition('Stopped');
    }
  }

  onRequest(handler: Handler): void {
    this.lifecycle.assertCanRegisterHandler();
    this.handler = handler;
    if (this.lifecycle.state === 'Running') {
      BUS.set(this.localScopeId, handler);
    }
  }

  async send(target: MeshAddress, req: MeshRequest, opts?: SendOpts): Promise<MeshResponse> {
    this.lifecycle.assertCanSend();
    if (target.kind !== 'loopback') {
      return toMeshResponse(req.id, new IllegalStateError(`loopback cannot reach ${target.kind}`));
    }
    const peerHandler = BUS.get(target.scopeId);
    if (!peerHandler) {
      return toMeshResponse(req.id, new IllegalStateError('peer not present on loopback bus'));
    }

    const ctx: TransportCtx = {
      authenticatedScope: req.fromScope, // loopback trusts in-process identity (test only)
      peerId: 'loopback',
      remoteAddr: 'inproc',
    };

    const deadlineDelta = Math.max(0, req.deadlineMs - Date.now());
    const perAttemptMs = Math.min(deadlineDelta, opts?.timeoutMs ?? deadlineDelta);

    try {
      return await raceWithDeadline(peerHandler(req, ctx), perAttemptMs, opts?.signal);
    } catch (e) {
      return toMeshResponse(req.id, e);
    }
  }

  peers(): PeerInfo[] {
    if (this.lifecycle.state !== 'Running') return [];
    const list: PeerInfo[] = [];
    for (const scopeId of BUS.keys()) {
      if (scopeId === this.localScopeId) continue;
      list.push({
        scopeId,
        transport: 'loopback',
        connectedAt: this.connectedAt,
      });
    }
    return list;
  }
}

function raceWithDeadline<T>(
  p: Promise<T>,
  ms: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new DeadlineExceeded()), Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(t);
      reject(new DeadlineExceeded('aborted'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
