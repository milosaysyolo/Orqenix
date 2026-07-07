import {
  Ed25519IdentityVerifier,
  LRUKeyStore,
  Ed25519Signer,
  makeSignFn,
  generateEd25519Keypair,
  exportEd25519PublicKeyRaw,
} from "@orqenix/transport-security";
import { HttpMeshTransport } from "@orqenix/mesh-transport-http";
import type {
  CapabilityToken,
  MeshAddress,
  MeshRequest,
  ScopeId,
} from "@orqenix/mesh-transport-core";

async function main(): Promise<void> {
  const scopeA = "scp_b3_wire_a" as ScopeId;
  const scopeB = "scp_b3_wire_b" as ScopeId;

  const ks = new LRUKeyStore();
  const kpA = await generateEd25519Keypair();
  const kpB = await generateEd25519Keypair();
  ks.put(scopeA, await exportEd25519PublicKeyRaw(kpA.publicKey));
  ks.put(scopeB, await exportEd25519PublicKeyRaw(kpB.publicKey));

  const verifier = new Ed25519IdentityVerifier({ keyStore: ks });
  const signerA = new Ed25519Signer({ fromScope: scopeA, privateKey: kpA.privateKey });
  const signerB = new Ed25519Signer({ fromScope: scopeB, privateKey: kpB.privateKey });

  const transportA = new HttpMeshTransport({
    localScopeId: scopeA,
    verifier,
    sign: makeSignFn(signerA),
  });
  const transportB = new HttpMeshTransport({
    localScopeId: scopeB,
    verifier,
    sign: makeSignFn(signerB),
  });

  transportB.onRequest(async (req) => ({
    id: req.id,
    status: "ok",
    payload: new Uint8Array([0xee]),
  }));

  await transportA.start();
  await transportB.start();

  const req: MeshRequest = {
    id: "01HVWIREDEADBEEFDEADBEEFDE",
    fromScope: scopeA,
    toScope: scopeB,
    capability: "cap_wire" as CapabilityToken,
    method: "memory.query",
    payload: new Uint8Array([1, 2, 3]),
    deadlineMs: Date.now() + 5000,
    trace: { traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" },
  };
  const addr: MeshAddress = { kind: "http", baseUrl: `http://127.0.0.1:${transportB.port()}` };

  const resp = await transportA.send(addr, req);

  if (resp.status !== "ok") {
    console.error(`WIRE FAIL: response status ${resp.status}, code ${resp.error?.code}`);
    process.exit(1);
  }
  if (resp.payload?.at(-1) !== 0xee) {
    console.error(`WIRE FAIL: payload mismatch`);
    process.exit(1);
  }

  await transportA.stop();
  await transportB.stop();

  console.log("WIRE OK");
  process.exit(0);
}

main().catch((e) => {
  console.error("WIRE FAIL:", e);
  process.exit(1);
});
