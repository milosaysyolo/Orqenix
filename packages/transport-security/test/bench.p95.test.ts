import { describe, it, expect } from 'vitest';
import { CapabilityVerifier } from '../src/verifier.js';
import { LRUKeyStore } from '../src/key-store.js';
import {
  b64urlEncode,
  ed25519Sign,
  exportEd25519PublicKeyRaw,
  generateEd25519Keypair,
} from '../src/ed25519.js';
import {
  canonicalSigningBytes,
  encodeCapabilityToken,
  type CapabilityTokenFields,
} from '../src/capability-token.js';
import type { ScopeId } from '@orqenix/mesh-transport-core';

const ITER = Number(process.env.G40_BENCH_ITER ?? 100_000);
const CI_TOLERANCE_MS = 5;

describe('CapabilityVerifier p95 benchmark', () => {
  it(`p95 verify under 10ms (CI tolerance +${CI_TOLERANCE_MS}ms) over ${ITER} iterations`, async () => {
    const kp = await generateEd25519Keypair();
    const ks = new LRUKeyStore();
    const iss = 'scp_b3_B' as ScopeId;
    const sub = 'scp_b3_A' as ScopeId;
    ks.put(iss, await exportEd25519PublicKeyRaw(kp.publicKey));

    const base: Omit<CapabilityTokenFields, 'sig'> = {
      iss, sub,
      caps: ['memory.query', 'kb.recall.*'],
      exp: Date.now() + 600_000,
      jti: 'jti-bench',
    };
    const signed = await ed25519Sign(kp.privateKey, canonicalSigningBytes(base));
    const wire = encodeCapabilityToken({ ...base, sig: b64urlEncode(signed) });

    const v = new CapabilityVerifier({ keyStore: ks });

    for (let i = 0; i < 1_000; i++) {
      await v.verify({ capability: wire, fromScope: sub, toScope: iss, method: 'memory.query' });
    }

    const samples = new Float64Array(ITER);
    for (let i = 0; i < ITER; i++) {
      const start = performance.now();
      await v.verify({ capability: wire, fromScope: sub, toScope: iss, method: 'memory.query' });
      samples[i] = performance.now() - start;
    }

    const sorted = Array.from(samples).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(ITER * 0.5)];
    const p95 = sorted[Math.floor(ITER * 0.95)];
    const p99 = sorted[Math.floor(ITER * 0.99)];

    console.log(`[bench] verify p50=${p50.toFixed(3)}ms p95=${p95.toFixed(3)}ms p99=${p99.toFixed(3)}ms n=${ITER}`);
    expect(p95).toBeLessThan(10 + CI_TOLERANCE_MS);
  }, 60_000);
});
