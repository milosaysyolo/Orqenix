import http from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { request as undiciRequest } from 'undici';
import {
  CapabilityError,
  DeadlineExceeded,
  ErrorCode,
  HandlerError,
  TransportError,
  TransportLifecycle,
  decodeRequest,
  decodeResponse,
  encodeRequest,
  encodeResponse,
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
import { CONTENT_TYPE, HDR, assertHeadersMatchBody, buildHeaders } from './headers.js';
import { DedupCache } from './dedup-cache.js';
import { runWithRetry, type AttemptResult } from './retry.js';
import type { IdentityVerifier, SignFn } from './identity.js';

export interface HttpMeshTransportOptions {
  localScopeId: ScopeId;
  verifier: IdentityVerifier;
  sign: SignFn;
  host?: string;
  port?: number;
  dedup?: DedupCache;
  maxRetries?: number;
  baseDelayMs?: number;
}

type Handler = (req: MeshRequest, ctx: TransportCtx) => Promise<MeshResponse>;

const PATH = '/orqenix/mesh/v1/rpc';

export class HttpMeshTransport implements MeshTransport {
  readonly kind = 'http' as const;
  readonly localScopeId: ScopeId;

  private readonly verifier: IdentityVerifier;
  private readonly sign: SignFn;
  private readonly host: string;
  private readonly desiredPort: number;
  private readonly dedup: DedupCache;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  private lifecycle = new TransportLifecycle();
  private server?: http.Server;
  private readonly sockets = new Set<Socket>();
  private handler?: Handler;
  private boundPort = 0;

  constructor(opts: HttpMeshTransportOptions) {
    this.localScopeId = opts.localScopeId;
    this.verifier = opts.verifier;
    this.sign = opts.sign;
    this.host = opts.host ?? '127.0.0.1';
    this.desiredPort = opts.port ?? 0;
    this.dedup = opts.dedup ?? new DedupCache();
    this.maxRetries = opts.maxRetries ?? 2;
    this.baseDelayMs = opts.baseDelayMs ?? 100;
  }

  port(): number {
    return this.boundPort;
  }

  peers(): PeerInfo[] {
    return [];
  }

  async start(): Promise<void> {
    if (!this.lifecycle.assertCanStart()) return;
    this.lifecycle.transition('Starting');
    try {
      const server = http.createServer((req, res) => void this.handleInbound(req, res));
      server.on('connection', (s) => {
        this.sockets.add(s);
        s.on('close', () => this.sockets.delete(s));
      });
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(this.desiredPort, this.host, () => {
          server.off('error', reject);
          resolve();
        });
      });
      const addr = server.address() as AddressInfo | null;
      this.boundPort = addr?.port ?? 0;
      this.server = server;
      this.lifecycle.transition('Running');
    } catch (e) {
      this.lifecycle.transition('Failed');
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (!this.lifecycle.assertCanStop()) return;
    this.lifecycle.transition('Stopping');
    try {
      const s = this.server;
      this.server = undefined;
      for (const sock of this.sockets) sock.destroy();
      this.sockets.clear();
      if (s) await new Promise<void>((resolve) => s.close(() => resolve()));
      this.handler = undefined;
      this.boundPort = 0;
    } finally {
      this.lifecycle.transition('Stopped');
    }
  }

  onRequest(handler: Handler): void {
    this.lifecycle.assertCanRegisterHandler();
    this.handler = handler;
  }

  private async readBody(req: http.IncomingMessage): Promise<Uint8Array> {
    const chunks: Buffer[] = [];
    let total = 0;
    const MAX = 16 * 1024 * 1024;
    return await new Promise<Uint8Array>((resolve, reject) => {
      req.on('data', (c: Buffer) => {
        total += c.length;
        if (total > MAX) {
          reject(new TransportError('body too large', ErrorCode.TRANSPORT));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
      req.on('error', reject);
    });
  }

  private writeMeshResponse(res: http.ServerResponse, httpStatus: number, resp: MeshResponse): void {
    const body = encodeResponse(resp);
    res.writeHead(httpStatus, { 'content-type': CONTENT_TYPE });
    res.end(Buffer.from(body));
  }

  private async handleInbound(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method !== 'POST' || req.url !== PATH) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }

    let mreq: MeshRequest;
    try {
      const body = await this.readBody(req);
      mreq = decodeRequest(body);
    } catch (e) {
      this.writeMeshResponse(res, 500, toMeshResponse('unknown', e));
      return;
    }

    try {
      assertHeadersMatchBody(req.headers as Record<string, string | string[] | undefined>, mreq);
    } catch (e) {
      this.writeMeshResponse(res, 403, toMeshResponse(mreq.id, e));
      return;
    }

    const cached = this.dedup.get(mreq.id);
    if (cached) {
      this.writeMeshResponse(res, 409, cached);
      return;
    }

    const sigHeader = (req.headers[HDR.SCOPE_SIG] as string | undefined) ?? '';
    let identityOk = false;
    try {
      identityOk = await this.verifier.verifyScopeSig(mreq.fromScope, mreq.id, mreq.toScope, sigHeader);
    } catch {
      identityOk = false;
    }
    if (!identityOk) {
      const denied = toMeshResponse(mreq.id, new CapabilityError('scope-sig invalid', ErrorCode.IDENTITY_SIG_INVALID));
      this.writeMeshResponse(res, 403, denied);
      return;
    }

    if (Date.now() >= mreq.deadlineMs) {
      this.writeMeshResponse(res, 408, toMeshResponse(mreq.id, new DeadlineExceeded()));
      return;
    }

    if (!this.handler) {
      this.writeMeshResponse(res, 500, toMeshResponse(mreq.id, new HandlerError('no handler')));
      return;
    }

    let response: MeshResponse;
    try {
      response = await this.handler(mreq, { authenticatedScope: mreq.fromScope, remoteAddr: req.socket.remoteAddress ?? undefined });
    } catch (e) {
      response = toMeshResponse(mreq.id, e);
    }

    const ttl = Math.max(0, mreq.deadlineMs - Date.now());
    this.dedup.set(mreq.id, response, ttl);

    this.writeMeshResponse(res, statusToHttp(response.status), response);
  }

  async send(target: MeshAddress, req: MeshRequest, opts?: SendOpts): Promise<MeshResponse> {
    this.lifecycle.assertCanSend();
    if (target.kind !== 'http') {
      return toMeshResponse(req.id, new Error(`http cannot reach ${target.kind}`));
    }

    const sigB64u = await this.sign(req.id, req.toScope);
    const headers = buildHeaders(req, sigB64u);
    const body = encodeRequest(req);
    const url = stripTrailingSlash(target.baseUrl) + PATH;

    return runWithRetry(
      async (): Promise<AttemptResult> => {
        const remaining = Math.max(0, req.deadlineMs - Date.now());
        const perAttempt = Math.min(remaining, opts?.timeoutMs ?? remaining);
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), perAttempt);
        if (opts?.signal) {
          if (opts.signal.aborted) ac.abort();
          else opts.signal.addEventListener('abort', () => ac.abort(), { once: true });
        }

        try {
          const r = await undiciRequest(url, { method: 'POST', headers: { ...headers }, body: Buffer.from(body), signal: ac.signal });
          const buf = Buffer.from(await r.body.arrayBuffer());

          if (r.statusCode === 200) {
            try { return { kind: 'response', resp: decodeResponse(new Uint8Array(buf)) }; }
            catch (e) { return { kind: 'response', resp: toMeshResponse(req.id, e) }; }
          }
          if (r.statusCode === 403) {
            try { return { kind: 'fatal', resp: decodeResponse(new Uint8Array(buf)) }; }
            catch { return { kind: 'fatal', resp: { id: req.id, status: 'denied', error: { code: 'E_CAP_INVALID', message: 'denied' } } }; }
          }
          if (r.statusCode === 408) return { kind: 'timeout' };
          if (r.statusCode === 409) {
            try { return { kind: 'response', resp: decodeResponse(new Uint8Array(buf)) }; }
            catch { return { kind: 'response', resp: { id: req.id, status: 'ok' } }; }
          }
          if (r.statusCode === 429) {
            const ra = Number(r.headers['retry-after']);
            const retryAfterMs = Number.isFinite(ra) ? ra * 1000 : undefined;
            return { kind: 'retry', retryAfterMs };
          }
          return { kind: 'response', resp: { id: req.id, status: 'error', error: { code: 'E_TRANSPORT', message: `http ${r.statusCode}` } } };
        } catch (e) {
          if ((e as { name?: string }).name === 'AbortError') return { kind: 'timeout' };
          return { kind: 'timeout' };
        } finally {
          clearTimeout(t);
        }
      },
      { maxRetries: this.maxRetries, baseDelayMs: this.baseDelayMs, deadlineMs: req.deadlineMs, signal: opts?.signal },
    ).then((resp) => (resp.id ? resp : { ...resp, id: req.id }));
  }
}

function statusToHttp(status: MeshResponse['status']): number {
  switch (status) {
    case 'ok': return 200;
    case 'denied': return 403;
    case 'timeout': return 408;
    case 'error':
    default: return 500;
  }
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}