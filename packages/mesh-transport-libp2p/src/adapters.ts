// SPDX-License-Identifier: Apache-2.0
import { memory } from "@libp2p/memory";
import { tcp } from "@libp2p/tcp";
import { webSockets } from "@libp2p/websockets";
import type { Libp2pOptions } from "libp2p";

export type AdapterKind = "tcp" | "websockets" | "memory";

export function buildTransports(adapters: AdapterKind[]): NonNullable<Libp2pOptions["transports"]> {
  const out: NonNullable<Libp2pOptions["transports"]> = [];
  const seen = new Set<AdapterKind>();
  for (const a of adapters) {
    if (seen.has(a)) continue;
    seen.add(a);
    switch (a) {
      case "tcp":
        out.push(tcp());
        break;
      case "websockets":
        out.push(webSockets());
        break;
      case "memory":
        out.push(memory());
        break;
      default: {
        const _exhaustive: never = a;
        void _exhaustive;
      }
    }
  }
  return out;
}

export function defaultListenForAdapters(adapters: AdapterKind[], host = "127.0.0.1"): string[] {
  const out: string[] = [];
  for (const a of adapters) {
    switch (a) {
      case "tcp":
        out.push(`/ip4/${host}/tcp/0`);
        break;
      case "websockets":
        out.push(`/ip4/${host}/tcp/0/ws`);
        break;
      case "memory":
        out.push("/memory/orqenix-mesh");
        break;
    }
  }
  return out;
}
