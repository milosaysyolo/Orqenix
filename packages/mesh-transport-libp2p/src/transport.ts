import type { Connection, Libp2p, Stream } from '@libp2p/interface';
import {
  CapabilityError,
  DeadlineExceeded,
  ErrorCode,
  TransportLifecycle,
  toMeshResponse,
  type MeshAddress,
  type MeshRequest,
  type MeshResponse,
  type MeshTransport,
  type PeerInfo,
  type ScopeId,
  type SendOpts,
  type TransportCtx,
} from '@orqenix/mesh-transport-core';
import { derivePeerFromScope, scopeIdToSaltBytes } from './peer-id.js';
import { createOrqenixLibp2pNode } from './node-config.js';
import { supportedProtocols } from './protocol.js';
import {
  NoopIdentityVerifier,
  NoopSigner,
  performInitiatorHandshake,
  performResponderHandshake,
  type CapabilityHandshakeMessage,
  type IdentityVerifier,
  type SignFn,
} from "./handshake.js";
import { handleRequestStream, sendRequestOverStream } from "./streams.js";
import type { AdapterKind } from "./adapters.js";
import { ConnectionManager } from "./connection-manager.js";
import { Dialer, type DialBackoff } from "./dialer.js";

export interface Libp2pMeshTransportOptions {
  localScopeId: ScopeId;
  scopeSeed: Uint8Array;
  adapters?: AdapterKind[];
  listen?: string[];
  verifier?: IdentityVerifier;
  sign?: SignFn;
  idleConnectionTimeoutMs?: number;
  stopGracePeriodMs?: number;
  dialBackoff?: DialBackoff;
}

type Handler = (req: MeshRequest, ctx: TransportCtx) => Promise<MeshResponse>;

interface ConnState {
  accepted: boolean;
}

export class Libp2pMeshTransport implements MeshTransport {
  readonly kind = "libp2p" as const;
  readonly localScopeId: ScopeId;

  private readonly scopeSeed: Uint8Array;
  private readonly adapters: AdapterKind[];
  private readonly listen?: string[];
  private readonly verifier: IdentityVerifier;
  private readonly sign: SignFn;
  private readonly connMgr: ConnectionManager;
  private readonly dialer: Dialer;

  private lifecycle = new TransportLifecycle();
  private node?: Libp2p;
  private handler?: Handler;
  private connStates = new WeakMap<Connection, ConnState>();
  private connectedAt = 0;

  constructor(opts: Libp2pMeshTransportOptions) {
    this.localScopeId = opts.localScopeId;
    this.scopeSeed = opts.scopeSeed;
    this.adapters = opts.adapters ?? ["memory"];
    this.listen = opts.listen;
    this.verifier = opts.verifier ?? new NoopIdentityVerifier();
    this.sign = opts.sign ?? NoopSigner;
    this.connMgr = new ConnectionManager({
      idleTimeoutMs: opts.idleConnectionTimeoutMs,
      stopGracePeriodMs: opts.stopGracePeriodMs,
    });
    this.dialer = new Dialer({ backoff: opts.dialBackoff });
  }

  onRequest(handler: Handler): void {
    this.lifecycle.assertCanRegisterHandler();
    this.handler = handler;
  }

  peers(): PeerInfo[] {
    if (this.lifecycle.state !== "Running" || !this.node) return [];
    const out: PeerInfo[] = [];
    for (const conn of this.node.getConnections()) {
      out.push({
        scopeId: ("peer:" + conn.remotePeer.toString()) as ScopeId,
        peerId: conn.remotePeer.toString(),
        transport: "libp2p",
        connectedAt: this.connectedAt,
      });
    }
    return out;
  }

  multiaddrs(): string[] {
    if (!this.node) return [];
    return this.node.getMultiaddrs().map((m) => m.toString());
  }

  connectionCount(): number {
    return this.connMgr.size();
  }

  async start(): Promise<void> {
    if (!this.lifecycle.assertCanStart()) return;
    this.lifecycle.transition("Starting");
    try {
      const saltBytes = scopeIdToSaltBytes(this.localScopeId);
      const derived = await derivePeerFromScope({
        scopeSeed: this.scopeSeed,
        scopeIdBytes: saltBytes,
      });
      const node = await createOrqenixLibp2pNode({
        privateKey: derived.privateKey,
        adapters: this.adapters,
        listen: this.listen,
      });

      await node.handle(supportedProtocols(), async ({ stream, connection }) => {
        try {
          this.connMgr.touch(connection);
          let state = this.connStates.get(connection);
          if (!state) {
            const ourMsg: CapabilityHandshakeMessage = {
              capability: "noop-cap-responder",
              fromScope: this.localScopeId,
              toScope: "peer:" + connection.remotePeer.toString(),
              sig: "noop-sig-responder",
            };
            const { accepted } = await performResponderHandshake(stream, ourMsg, this.verifier);
            state = { accepted };
            this.connStates.set(connection, state);
            if (!accepted) {
              await stream.close();
              return;
            }
          }

          if (!state.accepted) {
            await stream.close();
            return;
          }

          await handleRequestStream(stream, async (req) => {
            this.connMgr.touch(connection);
            if (!this.handler) {
              return toMeshResponse(req.id, new CapabilityError("no handler", ErrorCode.HANDLER));
            }
            try {
              return await this.handler(req, {
                authenticatedScope: req.fromScope,
                peerId: connection.remotePeer.toString(),
                remoteAddr: connection.remoteAddr.toString(),
              });
            } catch (e) {
              return toMeshResponse(req.id, e);
            }
          });
        } catch (e) {
          try {
            await stream.close();
          } catch {
            /* ignore */
          }
        }
      });

      await node.start();
      this.node = node;
      this.connMgr.attach(node);
      this.connectedAt = Date.now();
      this.lifecycle.transition("Running");
    } catch (e) {
      this.lifecycle.transition("Failed");
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.lifecycle.assertCanStop()) return;
    this.lifecycle.transition("Stopping");
    try {
      const node = this.node;
      this.node = undefined;
      this.handler = undefined;
      this.connectedAt = 0;

      await this.connMgr.drain();

      if (node) {
        try {
          await node.unhandle(supportedProtocols());
        } catch {
          /* ignore */
        }
        for (const c of node.getConnections()) {
          try {
            await c.close();
          } catch {
            /* ignore */
          }
        }
        await node.stop();
      }
    } finally {
      this.lifecycle.transition("Stopped");
    }
  }

  async send(target: MeshAddress, req: MeshRequest, opts?: SendOpts): Promise<MeshResponse> {
    this.lifecycle.assertCanSend();
    if (target.kind !== "libp2p") {
      return toMeshResponse(req.id, new Error(`libp2p cannot reach ${target.kind}`));
    }
    if (!this.node) {
      return toMeshResponse(req.id, new Error("libp2p node not running"));
    }

    const remaining = Math.max(0, req.deadlineMs - Date.now());
    const perAttempt = Math.min(remaining, opts?.timeoutMs ?? remaining);

    try {
      const conn = await this.dialer.dial(this.node, target.multiaddr, {
        deadlineMs: req.deadlineMs,
        signal: opts?.signal,
      });
      this.connMgr.touch(conn);

      let state = this.connStates.get(conn);
      if (!state) {
        const hsStream: Stream = await conn.newStream(supportedProtocols());
        this.connMgr.touch(conn);
        const sig = await this.sign(req.id, req.toScope);
        const ourMsg: CapabilityHandshakeMessage = {
          capability: req.capability,
          fromScope: this.localScopeId,
          toScope: req.toScope,
          sig,
        };
        try {
          const peerMsg = await performInitiatorHandshake(hsStream, ourMsg);
          const ok = await this.verifier.verifyScopeSig(
            peerMsg.fromScope as ScopeId,
            peerMsg.capability,
            peerMsg.toScope as ScopeId,
            peerMsg.sig,
          );
          state = { accepted: ok };
          this.connStates.set(conn, state);
        } finally {
          try {
            await hsStream.close();
          } catch {
            /* ignore */
          }
        }
        if (!state.accepted) {
          return toMeshResponse(
            req.id,
            new CapabilityError("peer rejected handshake", ErrorCode.IDENTITY_SIG_INVALID),
          );
        }
      }
      if (!state.accepted) {
        return toMeshResponse(
          req.id,
          new CapabilityError("connection not accepted", ErrorCode.IDENTITY_SIG_INVALID),
        );
      }

      const stream: Stream = await conn.newStream(supportedProtocols());
      this.connMgr.touch(conn);
      try {
        const respPromise = sendRequestOverStream(stream, req);
        const result = await raceWithDeadline(respPromise, perAttempt, opts?.signal, req.id);
        this.connMgr.touch(conn);
        return result as MeshResponse;
      } finally {
        try {
          await stream.close();
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      return toMeshResponse(req.id, e);
    }
  }
}

function raceWithDeadline<T>(
  p: Promise<T>,
  ms: number,
  signal: AbortSignal | undefined,
  reqId: string,
): Promise<T | MeshResponse> {
  return new Promise<T | MeshResponse>((resolve, reject) => {
    const t = setTimeout(
      () => resolve(toMeshResponse(reqId, new DeadlineExceeded())),
      Math.max(0, ms),
    );
    const onAbort = () => {
      clearTimeout(t);
      resolve(toMeshResponse(reqId, new DeadlineExceeded("aborted")));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
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
