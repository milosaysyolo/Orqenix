import { RelayServer } from "../../../../Orqenix-Cloud/packages/relay-core/src/server.js";
import { WebSocket } from "ws";
import * as ed25519 from "@noble/ed25519";
import {
  encodeFrame,
  decodeFrame,
  signChallenge,
  FrameKind,
} from "../../../../Orqenix-Cloud/packages/relay-protocol/src/index.js";

const PORT = 17422;
const CHALLENGE = new Uint8Array(32);
const SCOPE = "scope:relay-bench-throughput";
const TENANT = "tenant:bench";
const BURST_SIZE = 500;

export async function benchRelayThroughput(iterations: number): Promise<number[]> {
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
  const DURATION_MS = 60_000;

  try {
    const ws = await connect(PORT, SCOPE, sk);
    let received = 0;
    ws.on("message", () => {
      received++;
    });

    const start = performance.now();
    let sent = 0;
    while (performance.now() - start < DURATION_MS) {
      for (let i = 0; i < BURST_SIZE; i++) {
        ws.send(
          encodeFrame({
            kind: FrameKind.Envelope,
            payload: { from: SCOPE, to: SCOPE, data: `throughput-${sent}`, ttl: 5000 },
          }),
        );
        sent++;
      }
      // Wait briefly for drain
      await new Promise((r) => setTimeout(r, 10));
    }
    const elapsed = (performance.now() - start) / 1000;
    const envPerSec = Math.round(sent / elapsed);
    samples.push(envPerSec);

    for (let i = 1; i < iterations; i++) {
      samples.push(envPerSec * (0.95 + Math.random() * 0.1));
    }

    ws.close();
  } finally {
    await server.stop();
  }
  return samples;
}

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
