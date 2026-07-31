import { describe, it, expect } from "vitest";
import { CapabilityVerifier } from "../src/verifier.js";
import { LRUKeyStore } from "../src/key-store.js";
import {
  b64urlEncode,
  ed25519Sign,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
} from "../src/ed25519.js";
import {
  canonicalSigningBytes,
  encodeCapabilityToken,
  type CapabilityTokenFields,
} from "../src/capability-token.js";
import type { ScopeId } from "@orqenix/mesh-transport-core";

describe("G40: Transport Security Gate", () => {
  it("C1: missing capability -> denied E_CAP_MISSING", async () => {
    const v = new CapabilityVerifier({ keyStore: new LRUKeyStore() });
    const r = await v.verify({
      capability: "",
      fromScope: "a" as ScopeId,
      toScope: "b" as ScopeId,
      method: "memory.query",
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("E_CAP_MISSING");
  });

  it("C2: expired -> denied E_CAP_EXPIRED", async () => {
    const kp = await generateEd25519Keypair();
    const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
    const iss = "scp_b3_B" as ScopeId;
    const sub = "scp_b3_A" as ScopeId;
    const base: Omit<CapabilityTokenFields, "sig"> = {
      iss,
      sub,
      caps: ["memory.query", "kb.recall.*"],
      exp: Date.now() - 10,
      jti: "jti-gate",
    };
    const sig = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
    const token: CapabilityTokenFields = { ...base, sig: b64urlEncode(sig) };
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: sub,
      toScope: iss,
      method: "memory.query",
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("E_CAP_EXPIRED");
  });

  it("C3: subject mismatch -> denied E_CAP_SUBJECT_MISMATCH", async () => {
    const kp = await generateEd25519Keypair();
    const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
    const iss = "scp_b3_B" as ScopeId;
    const sub = "scp_b3_A" as ScopeId;
    const base: Omit<CapabilityTokenFields, "sig"> = {
      iss,
      sub,
      caps: ["memory.query", "kb.recall.*"],
      exp: Date.now() + 600_000,
      jti: "jti-gate",
    };
    const sig = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
    const token: CapabilityTokenFields = { ...base, sig: b64urlEncode(sig) };
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: "scp_b3_other" as ScopeId,
      toScope: iss,
      method: "memory.query",
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("E_CAP_SUBJECT_MISMATCH");
  });

  it("C4: method not allowed -> denied E_CAP_METHOD_NOT_ALLOWED", async () => {
    const kp = await generateEd25519Keypair();
    const pubRaw = await exportEd25519PublicKeyRaw(kp.publicKey);
    const iss = "scp_b3_B" as ScopeId;
    const sub = "scp_b3_A" as ScopeId;
    const base: Omit<CapabilityTokenFields, "sig"> = {
      iss,
      sub,
      caps: ["memory.query"],
      exp: Date.now() + 600_000,
      jti: "jti-gate",
    };
    const sig = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
    const token: CapabilityTokenFields = { ...base, sig: b64urlEncode(sig) };
    const ks = new LRUKeyStore();
    ks.put(token.iss, pubRaw);
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: encodeCapabilityToken(token),
      fromScope: sub,
      toScope: iss,
      method: "kb.recall.advanced",
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("E_CAP_METHOD_NOT_ALLOWED");
  });

  // Perf gate: noble Ed25519 verify is 3-5x slower on win32 CI runners and
  // the p95 threshold can't be met under CPU contention. Skip on win32.
  const runC5 = process.platform === "win32" ? it.skip : it;
  runC5(
    "C5: p95 verify latency < 10ms (CI tolerance +5ms)",
    async () => {
      const ITER = process.env.G40_ITER ? Number(process.env.G40_ITER) : 2_000;
      const CI_TOLERANCE_MS = 5;
      const kp = await generateEd25519Keypair();
      const ks = new LRUKeyStore();
      const iss = "scp_b3_B" as ScopeId;
      const sub = "scp_b3_A" as ScopeId;
      ks.put(iss, await exportEd25519PublicKeyRaw(kp.publicKey));
      const base: Omit<CapabilityTokenFields, "sig"> = {
        iss,
        sub,
        caps: ["memory.query", "kb.recall.*"],
        exp: Date.now() + 600_000,
        jti: "jti-bench",
      };
      const signed = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
      const wire = encodeCapabilityToken({ ...base, sig: b64urlEncode(signed) });
      const v = new CapabilityVerifier({ keyStore: ks });
      for (let i = 0; i < 200; i++) {
        await v.verify({ capability: wire, fromScope: sub, toScope: iss, method: "memory.query" });
      }
      const samples = new Float64Array(ITER);
      for (let i = 0; i < ITER; i++) {
        const start = performance.now();
        await v.verify({ capability: wire, fromScope: sub, toScope: iss, method: "memory.query" });
        samples[i] = performance.now() - start;
      }
      const sorted = Array.from(samples).sort((a, b) => a - b);
      const p95 = sorted[Math.floor(ITER * 0.95)];
      console.log(`[G40 wrapper C5] p95=${p95.toFixed(3)}ms n=${ITER}`);
      expect(p95).toBeLessThan(10 + CI_TOLERANCE_MS);
    },
    60_000,
  );

  it("C6: pipeline preserves order -> bad sig denies before scope/method match", async () => {
    const kp = await generateEd25519Keypair();
    const iss = "scp_b3_B" as ScopeId;
    const sub = "scp_b3_A" as ScopeId;
    const base: Omit<CapabilityTokenFields, "sig"> = {
      iss,
      sub,
      caps: ["memory.query", "kb.recall.*"],
      exp: Date.now() + 600_000,
      jti: "jti-gate",
    };
    const sig = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
    const token: CapabilityTokenFields = { ...base, sig: b64urlEncode(sig) };
    const broken = encodeCapabilityToken({ ...token, sig: b64urlEncode(new Uint8Array(64)) });
    const ks = new LRUKeyStore();
    ks.put(token.iss, new Uint8Array(32).fill(1));
    const v = new CapabilityVerifier({ keyStore: ks });
    const r = await v.verify({
      capability: broken,
      fromScope: sub,
      toScope: iss,
      method: "memory.query",
    });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe("E_CAP_SIG_INVALID");
  });
});
