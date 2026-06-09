import { createLibp2p, type Libp2p, type Libp2pOptions } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import type { PrivateKey } from '@libp2p/interface';
import { buildTransports, defaultListenForAdapters, type AdapterKind } from './adapters.js';

export interface NodeConfigInput {
  privateKey: PrivateKey;
  adapters?: AdapterKind[];
  listen?: string[];
  maxInboundStreamsPerConn?: number;
  maxOutboundStreamsPerConn?: number;
}

/** Ensure memory addresses get a unique suffix to avoid collision in libp2p v2+. */
function ensureUniqueMemoryListen(listen: string[]): string[] {
  return listen.map((addr) => {
    if (addr === '/memory/orqenix-mesh') {
      const suffix = Math.random().toString(36).slice(2, 10);
      return `/memory/orqenix-mesh-${suffix}`;
    }
    return addr;
  });
}

export async function createOrqenixLibp2pNode(input: NodeConfigInput): Promise<Libp2p> {
  const adapters = input.adapters ?? ['memory'];
  const listen = ensureUniqueMemoryListen(input.listen ?? defaultListenForAdapters(adapters));

  const opts: Libp2pOptions = {
    privateKey: input.privateKey,
    addresses: { listen },
    transports: buildTransports(adapters),
    connectionEncrypters: [noise()],
    streamMuxers: [
      yamux({
        maxInboundStreams: input.maxInboundStreamsPerConn ?? 256,
        maxOutboundStreams: input.maxOutboundStreamsPerConn ?? 256,
      }),
    ],
    connectionManager: {
      inboundConnectionThreshold: 256,
      maxConnections: 512,
    },
    services: {},
  };
  return await createLibp2p(opts);
}
