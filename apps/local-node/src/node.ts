import {
  DefaultTransportRegistry,
  type MeshAddress,
  type MeshRequest,
  type MeshResponse,
  type MeshTransport,
  type ScopeId,
  type SendOpts,
  type TransportCtx,
} from "@orqenix/mesh-transport-core";
import { HttpMeshTransport } from "@orqenix/mesh-transport-http";
import { Libp2pMeshTransport } from "@orqenix/mesh-transport-libp2p";
import { MeshDiscovery, makeMdnsService } from "@orqenix/mesh-discovery";
import {
  CapabilityVerifier,
  Ed25519IdentityVerifier,
  Ed25519Signer,
  LRUKeyStore,
  makeSignFn,
} from "@orqenix/transport-security";
import { MeshLogger, MeshMetrics } from "@orqenix/mesh-observability";
import { MeshRouter, MeshRouterBuilder } from "@orqenix/mesh-router";
import { AddressBook } from "./address-book.js";
import type { LocalIdentity } from "./identity-loader.js";
import type { BootstrapConfig, TransportsConfig } from "./config.js";

export type AppHandler = (req: MeshRequest, ctx: TransportCtx) => Promise<MeshResponse>;

export interface LocalNodeOptions {
  identity: LocalIdentity;
  config: TransportsConfig;
  bootstrap?: BootstrapConfig;
  addressBook: AddressBook;
  handler: AppHandler;
  logger?: MeshLogger;
  metrics?: MeshMetrics;
  keyResolver?: { resolve(scopeId: ScopeId): Promise<Uint8Array | undefined> };
}

export interface LocalNodeRuntime {
  router: MeshRouter;
  registry: DefaultTransportRegistry;
  discovery?: MeshDiscovery;
  httpTransport?: HttpMeshTransport;
  libp2p?: Libp2pMeshTransport;
  stop(): Promise<void>;
  status(): NodeStatus;
}

export interface NodeStatus {
  scopeId: ScopeId;
  transports: Array<{ kind: string; addresses: string[]; peers: number }>;
  breaker: Array<{ kind: string; state: string }>;
  discovery: { entries: number };
  keyStore: { hits: number; misses: number; size: number };
}

export async function startLocalNode(opts: LocalNodeOptions): Promise<LocalNodeRuntime> {
  const logger = opts.logger ?? new MeshLogger({ level: "info" });
  const metrics = opts.metrics ?? new MeshMetrics();
  const hooks = { logger, metrics };

  const keyStore = new LRUKeyStore({ resolver: opts.keyResolver });
  keyStore.put(opts.identity.scopeId, opts.identity.publicKeyRaw);

  const verifier = new CapabilityVerifier({ keyStore });
  const idVerifier = new Ed25519IdentityVerifier({ keyStore });
  const signer = new Ed25519Signer({
    fromScope: opts.identity.scopeId,
    privateKey: opts.identity.privateKey,
  });
  const sign = makeSignFn(signer);

  const registry = new DefaultTransportRegistry();
  let httpTransport: HttpMeshTransport | undefined;
  let libp2pTransport: Libp2pMeshTransport | undefined;

  for (const t of opts.config.transports) {
    if (!t.enabled) continue;
    if (t.kind === "http") {
      const listen = t.listen[0] ?? "http://127.0.0.1:0";
      const url = new URL(listen);
      const http = new HttpMeshTransport({
        localScopeId: opts.identity.scopeId,
        verifier: idVerifier,
        sign,
        host: url.hostname,
        port: Number(url.port || 0),
      });
      await http.start();
      registry.register(http);
      httpTransport = http;
    } else if (t.kind === "libp2p") {
      libp2pTransport = new Libp2pMeshTransport({
        localScopeId: opts.identity.scopeId,
        scopeSeed: opts.identity.scopeSeed,
        adapters: ["tcp", "websockets"],
        listen: t.listen,
        verifier: idVerifier,
        sign,
        idleConnectionTimeoutMs: t.limits?.idleConnectionTimeoutMs,
      });
      await libp2pTransport.start();
      registry.register(libp2pTransport);
    }
  }

  const discovery = new MeshDiscovery({ bootstrap: opts.bootstrap });

  const router = new MeshRouterBuilder()
    .withLocalScope(opts.identity.scopeId)
    .withRegistry(registry)
    .withVerifier(verifier)
    .withAddressResolver(opts.addressBook.resolve.bind(opts.addressBook))
    .withPriority(opts.config.priority)
    .withBreaker(opts.config.circuitBreaker)
    .withHooks(hooks)
    .withHandler(opts.handler)
    .build();

  router.bindInboundToAllTransports();

  const runtime: LocalNodeRuntime = {
    router,
    registry,
    discovery,
    httpTransport,
    libp2p: libp2pTransport,
    async stop() {
      try {
        discovery.stop();
      } catch {
        /* ignore */
      }
      if (libp2pTransport) {
        try {
          await libp2pTransport.stop();
        } catch {
          /* ignore */
        }
      }
      if (httpTransport) {
        try {
          await httpTransport.stop();
        } catch {
          /* ignore */
        }
      }
    },
    status() {
      const transports: NodeStatus["transports"] = [];
      if (httpTransport) {
        transports.push({
          kind: "http",
          addresses: [`http://127.0.0.1:${httpTransport.port()}`],
          peers: httpTransport.peers().length,
        });
      }
      if (libp2pTransport) {
        transports.push({
          kind: "libp2p",
          addresses: libp2pTransport.multiaddrs(),
          peers: libp2pTransport.peers().length,
        });
      }
      const breaker = registry.all().map((t) => ({
        kind: t.kind,
        state: router.breakerStateOf(t.kind),
      }));
      return {
        scopeId: opts.identity.scopeId,
        transports,
        breaker,
        discovery: { entries: discovery.snapshot().length },
        keyStore: keyStore.getStats(),
      };
    },
  };
  return runtime;
}
