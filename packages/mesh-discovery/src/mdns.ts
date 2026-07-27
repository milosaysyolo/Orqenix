// packages/mesh-discovery/src/mdns.ts
import { mdns } from "@libp2p/mdns";

export const MDNS_SERVICE_TAG = "orqenix-mesh";
export const MDNS_DEFAULT_INTERVAL_MS = 10_000;
export const MDNS_PEER_RECORD_TTL_MS = 30_000;

export interface MdnsConfig {
  serviceTag?: string;
  intervalMs?: number;
}

export function makeMdnsService(cfg: MdnsConfig = {}): ReturnType<typeof mdns> {
  return mdns({
    serviceTag: cfg.serviceTag ?? MDNS_SERVICE_TAG,
    interval: cfg.intervalMs ?? MDNS_DEFAULT_INTERVAL_MS,
  });
}
