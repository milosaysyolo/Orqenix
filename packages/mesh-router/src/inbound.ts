import {
  toMeshResponse,
  CapabilityError,
  type ErrorCodeValue,
  type MeshRequest,
  type MeshResponse,
  type ScopeId,
  type TransportCtx,
} from "@orqenix/mesh-transport-core";
import type { ObservabilityHooks } from "@orqenix/mesh-observability";
import { onRpcDenied, onRpcIn, onRpcOut } from "@orqenix/mesh-observability";
import { CrossTransportDedup } from "./dedup.js";

export interface StructuralCapabilityVerifier {
  verify(input: {
    capability: string;
    fromScope: ScopeId;
    toScope: ScopeId;
    method: string;
  }): Promise<{ ok: true; token: unknown } | { ok: false; code: string; message: string }>;
}

export type AppHandler = (req: MeshRequest, ctx: TransportCtx) => Promise<MeshResponse>;

export interface InboundDispatchOptions {
  localScopeId: ScopeId;
  verifier: StructuralCapabilityVerifier;
  hooks?: ObservabilityHooks;
  dedup: CrossTransportDedup;
  handler: AppHandler;
}

export function makeInboundDispatch(opts: InboundDispatchOptions) {
  const { localScopeId, verifier, hooks, dedup, handler } = opts;

  return async function dispatch(req: MeshRequest, ctx: TransportCtx): Promise<MeshResponse> {
    const transportLabel = ctx.peerId ? guessTransport(ctx) : "unknown";
    const commonCtx = { scopeId: localScopeId, transport: transportLabel, peerId: ctx.peerId };

    if (hooks) onRpcIn(hooks, commonCtx, req);

    const cached = dedup.get(req.id);
    if (cached) {
      if (hooks) onRpcOut(hooks, commonCtx, req, cached, 0);
      return cached;
    }

    let verifyResult: Awaited<ReturnType<StructuralCapabilityVerifier["verify"]>>;
    try {
      verifyResult = await verifier.verify({
        capability: String(req.capability),
        fromScope: req.fromScope,
        toScope: req.toScope,
        method: req.method,
      });
    } catch (e) {
      const denied = toMeshResponse(
        req.id,
        new CapabilityError("verify threw", "E_CAP_INVALID" as ErrorCodeValue),
      );
      if (hooks)
        onRpcDenied(
          hooks,
          commonCtx,
          { id: req.id, method: req.method },
          denied.error?.code ?? "E_CAP_INVALID",
        );
      return denied;
    }

    if (!verifyResult.ok) {
      const denied: MeshResponse = {
        id: req.id,
        status: "denied",
        error: { code: verifyResult.code, message: verifyResult.message },
      };
      if (hooks)
        onRpcDenied(hooks, commonCtx, { id: req.id, method: req.method }, verifyResult.code);
      dedup.set(req.id, denied, Math.max(0, req.deadlineMs - Date.now()));
      return denied;
    }

    const t0 = Date.now();
    let response: MeshResponse;
    try {
      response = await handler(req, ctx);
    } catch (e) {
      response = toMeshResponse(req.id, e);
    }
    const durationMs = Date.now() - t0;

    if (hooks) onRpcOut(hooks, commonCtx, req, response, durationMs);

    dedup.set(req.id, response, Math.max(0, req.deadlineMs - Date.now()));

    return response;
  };
}

function guessTransport(ctx: TransportCtx): string {
  if (ctx.remoteAddr && ctx.remoteAddr.startsWith("inproc")) return "loopback";
  if (ctx.peerId && ctx.peerId.startsWith("12D3KooW")) return "libp2p";
  return "http";
}
