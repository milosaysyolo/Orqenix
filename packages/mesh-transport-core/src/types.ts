// packages/mesh-transport-core/src/types.ts
/**
 * Public type surface for the transport-agnostic mesh layer.
 * Agent note: this file is API-stable. Adding fields requires a CR amendment.
 */

/** Branded scope identifier (BLAKE3 of scope Ed25519 public key, base32). */
export type ScopeId = string & { readonly __brand: 'ScopeId' };

/** Branded opaque capability token; structural fields live in the security package. */
export type CapabilityToken = string & { readonly __brand: 'CapabilityToken' };

/** Address used by a concrete transport to reach a peer. Opaque to the router. */
export type MeshAddress =
  | { kind: 'http'; baseUrl: string }
  | { kind: 'libp2p'; multiaddr: string }
  | { kind: 'loopback'; scopeId: ScopeId };

/** Cooperative cancellation and per-attempt soft timeout. */
export interface SendOpts {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Context surfaced to the inbound handler after identity verification. */
export interface TransportCtx {
  peerId?: string;
  remoteAddr?: string;
  authenticatedScope: ScopeId;
}

/** Snapshot entry returned by peers(). */
export interface PeerInfo {
  scopeId: ScopeId;
  peerId?: string;
  transport: 'http' | 'libp2p' | 'loopback' | string;
  connectedAt: number;
  rttMs?: number;
}

/** W3C trace context propagated through every envelope. */
export interface TraceContext {
  traceparent: string;
  tracestate?: string;
}

/** Final, exhaustive status enum for a MeshResponse. */
export type MeshStatus = 'ok' | 'denied' | 'error' | 'timeout';

/** Canonical wire-level request shape, serialized as msgpack. */
export interface MeshRequest {
  id: string;
  fromScope: ScopeId;
  toScope: ScopeId;
  capability: CapabilityToken;
  method: string;
  payload: Uint8Array;
  deadlineMs: number;
  trace: TraceContext;
}

/** Canonical wire-level response shape. */
export interface MeshResponse {
  id: string;
  status: MeshStatus;
  payload?: Uint8Array;
  /** Populated only when status = 'error' or 'denied'. Must never include a stack trace. */
  error?: { code: string; message: string };
}

/** The interface every concrete transport implements. */
export interface MeshTransport {
  readonly kind: 'http' | 'libp2p' | 'loopback' | string;
  readonly localScopeId: ScopeId;

  start(): Promise<void>;
  stop(): Promise<void>;

  send(target: MeshAddress, req: MeshRequest, opts?: SendOpts): Promise<MeshResponse>;

  onRequest(handler: (req: MeshRequest, ctx: TransportCtx) => Promise<MeshResponse>): void;

  peers(): PeerInfo[];
}

/** Holds active transports; the seam for a future Pro Rust accelerator (Phase 7+). */
export interface TransportRegistry {
  register(t: MeshTransport): void;
  unregister(kind: string): void;
  get(kind: string): MeshTransport | undefined;
  all(): MeshTransport[];
  /** Deterministic ordering across repeated calls when health is unchanged. */
  reachable(scopeId: ScopeId): MeshTransport[];
}
