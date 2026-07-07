import { RelayServer } from "../../../../Orqenix-Cloud/packages/relay-core/src/server.js";
import { WebSocket } from "ws";
import * as ed25519 from "@noble/ed25519";
import {
  encodeFrame,
  decodeFrame,
  signChallenge,
  FrameKind,
} from "../../../../Orqenix-Cloud/packages/relay-protocol/src/index.js";

const PORT = 17421;
const CHALLENGE = new Uint8Array(32);
const SCOPE_A = "scope:relay-bench-a";
const SCOPE_B = "scope:relay-bench-b";
const TENANT = "tenant:bench";

async function connect(serverPort: number, scopeId: string, sk: Uint8Array): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });
  const nonce = Buffer.from(CHALLENGE).toString("base64");
  const sig = await signChallenge(sk, CHALLENGE);
  ws.send(
    encodeFrame({
      kind: FrameKind.Auth,
      payload: { scopeId, nonce, sig: Buffer.from(sig).toString("base64"), tenantId: TENANT },
    }),
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  return ws;
}

export async function benchRelayRtt(iterations: number): Promise<number[]> {
  const sk = ed25519.utils.randomPrivateKey();
  const pk = await ed25519.getPublicKeyAsync(sk);
  const server = new RelayServer({
    port: PORT,
    cloudPrivateKey: sk,
    region: "bench",
    directory: {
      async lookup(scopeId: string) {
        return { pubkey: pk, tenantId: TENANT };
      },
    },
  });
  await server.start();

  const samples: number[] = [];
  try {
    const wsA = await connect(PORT, SCOPE_A, sk);
    const wsB = await connect(PORT, SCOPE_B, sk);

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      wsA.send(
        encodeFrame({
          kind: FrameKind.Envelope,
          payload: { from: SCOPE_A, to: SCOPE_B, data: `ping-${i}`, ttl: 5000 },
        }),
      );
      await new Promise<void>((resolve) => wsB.once("message", () => resolve()));
      const t1 = performance.now();
      samples.push(t1 - t0);
    }
    wsA.close();
    wsB.close();
  } finally {
    await server.stop();
  }
  return samples;
}
